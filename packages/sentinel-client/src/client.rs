//! Sentinel client implementation.

use reqwest::Client;
use std::sync::Arc;

pub use crate::errors::{SentinelError, SentinelErrorCode, Result};
pub use crate::types::{AuthenticatedUser, LoginRequest, LoginResponse, SentinelConfig};

/// Sentinel client for communicating with Sentinel Auth service.
pub struct SentinelClient {
    inner: Arc<InnerClient>,
}

struct InnerClient {
    base_url: String,
    http_client: Client,
}

impl SentinelClient {
    /// Create a new Sentinel client with the given config.
    pub fn new(config: SentinelConfig) -> Result<Self> {
        let http_client = Client::builder()
            .timeout(config.timeout)
            .build()
            .map_err(|e| SentinelError::Config(format!("Failed to build HTTP client: {}", e)))?;

        Ok(Self {
            inner: Arc::new(InnerClient {
                base_url: config.base_url,
                http_client,
            }),
        })
    }

    /// Create a new Sentinel client with default config.
    pub fn default() -> Result<Self> {
        Self::new(SentinelConfig::default())
    }

    /// Validate a token via the /v1/api/auth/authenticate endpoint.
    ///
    /// This is the primary method used by the auth middleware.
    pub async fn authenticate(&self, token: &str) -> Result<AuthenticatedUser> {
        let url = format!("{}/v1/api/auth/authenticate", self.inner.base_url);

        let response = self
            .inner
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let auth_response: crate::types::AuthenticateResponse =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;

            Ok(AuthenticatedUser {
                user_id: auth_response.user_id,
                email: auth_response.email,
                first_name: auth_response.first_name,
                last_name: auth_response.last_name,
                email_verified: auth_response.email_verified,
                roles: auth_response.roles,
                permissions: auth_response.permissions,
            })
        } else {
            Err(SentinelError::from_response(
                status.as_u16(),
                &body,
                None,
            ))
        }
    }

    /// Get the base URL.
    pub fn base_url(&self) -> &str {
        &self.inner.base_url
    }

    /// Login with email and password.
    ///
    /// Returns either a session (on success) or MFA challenge.
    pub async fn login(&self, email: &str, password: &str) -> Result<LoginResponse> {
        let url = format!("{}/v1/api/auth/login", self.inner.base_url);

        let request = LoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        };

        let response = self
            .inner
            .http_client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let login_response: LoginResponse =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;
            Ok(login_response)
        } else {
            Err(SentinelError::from_response(
                status.as_u16(),
                &body,
                None,
            ))
        }
    }
}

impl Clone for SentinelClient {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

/// Builder for SentinelClient with fluent configuration.
pub struct SentinelClientBuilder {
    base_url: Option<String>,
    timeout_ms: Option<u64>,
}

impl SentinelClientBuilder {
    pub fn new() -> Self {
        Self {
            base_url: None,
            timeout_ms: None,
        }
    }

    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    pub fn timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = Some(ms);
        self
    }

    pub fn build(self) -> Result<SentinelClient> {
        let base_url = self
            .base_url
            .unwrap_or_else(|| "http://localhost:9000".to_string());

        let mut config = SentinelConfig::new(base_url);

        if let Some(timeout) = self.timeout_ms {
            config = config.with_timeout(timeout);
        }

        SentinelClient::new(config)
    }
}

impl Default for SentinelClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sentinel_client_builder() {
        let client = SentinelClientBuilder::new()
            .base_url("http://custom:9000")
            .timeout(5000)
            .build()
            .unwrap();

        assert_eq!(client.base_url(), "http://custom:9000");
    }

    #[test]
    fn test_default_config() {
        let client = SentinelClient::default().unwrap();
        assert_eq!(client.base_url(), "http://localhost:9000");
    }
}