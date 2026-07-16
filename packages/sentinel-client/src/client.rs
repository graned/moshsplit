//! Sentinel client implementation.

use reqwest::Client;
use std::sync::Arc;

pub use crate::errors::{Result, SentinelError, SentinelErrorCode};
pub use crate::types::{
    AuthenticatedUser, LoginRequest, LoginResponse, PaginatedUsersResponse, RefreshTokenRequest,
    RefreshTokenResponse, SentinelConfig, SentinelUser, TokenExchangeRequest,
    TokenExchangeResponse,
};

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

    /// Validate a token via POST /v1/api/auth/authenticate.
    ///
    /// This is the primary method used by the auth middleware.
    /// Sends the token as a Bearer token in the Authorization header.
    /// The method and path parameters are kept for backwards compatibility but
    /// the Sentinel API doesn't use them for the basic authenticate endpoint.
    pub async fn authenticate(
        &self,
        token: &str,
        _method: &str,
        _path: &str,
    ) -> Result<AuthenticatedUser> {
        let url = format!("{}/v1/api/auth/authenticate", self.inner.base_url);

        let response = self
            .inner
            .http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let envelope: crate::types::ApiEnvelope<crate::types::AuthenticateResponse> =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;

            // Clone request_id for use in closures
            let request_id = envelope.request_id.clone();

            if !envelope.success {
                let error = envelope.error.ok_or_else(|| SentinelError::Api {
                    message: "Unknown error".to_string(),
                    code: crate::errors::SentinelErrorCode::Unknown,
                    status: status.as_u16(),
                    request_id: Some(request_id.clone()),
                })?;
                return Err(SentinelError::Api {
                    message: error.message,
                    code: crate::errors::SentinelErrorCode::from_status(status.as_u16()),
                    status: status.as_u16(),
                    request_id: Some(request_id),
                });
            }

            let auth_response = envelope.data.ok_or_else(|| SentinelError::Api {
                message: "No data in response".to_string(),
                code: crate::errors::SentinelErrorCode::Unknown,
                status: status.as_u16(),
                request_id: Some(request_id.clone()),
            })?;

            // Return authenticated user with data from the response
            Ok(AuthenticatedUser {
                user_id: auth_response.user_id,
                email: None,
                first_name: None,
                last_name: None,
                email_verified: auth_response.email_verified,
                roles: auth_response.roles,
                permissions: Vec::new(), // Permissions not returned by this endpoint
            })
        } else {
            Err(SentinelError::from_response(status.as_u16(), &body, None))
        }
    }

    pub async fn list_users(
        &self,
        api_token: &str,
        page: Option<usize>,
        page_size: Option<usize>,
    ) -> Result<PaginatedUsersResponse> {
        let mut url = format!("{}/v1/api/admin/users", self.inner.base_url);
        let params: Vec<(&str, String)> = [
            page.map(|p| ("page", p.to_string())),
            page_size.map(|p| ("page_size", p.to_string())),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !params.is_empty() {
            url.push('?');
            for (i, (k, v)) in params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(k);
                url.push('=');
                url.push_str(v);
            }
        }

        let response = self
            .inner
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let envelope: crate::types::ApiEnvelope<PaginatedUsersResponse> =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;

            if !envelope.success {
                let error = envelope.error.ok_or_else(|| SentinelError::Api {
                    message: "Unknown error".to_string(),
                    code: crate::errors::SentinelErrorCode::Unknown,
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id.clone()),
                })?;
                return Err(SentinelError::Api {
                    message: error.message,
                    code: crate::errors::SentinelErrorCode::from_status(status.as_u16()),
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id),
                });
            }

            envelope.data.ok_or_else(|| SentinelError::Api {
                message: "No data in response".to_string(),
                code: crate::errors::SentinelErrorCode::Unknown,
                status: status.as_u16(),
                request_id: Some(envelope.request_id),
            })
        } else {
            Err(SentinelError::from_response(status.as_u16(), &body, None))
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
            Err(SentinelError::from_response(status.as_u16(), &body, None))
        }
    }

    /// Exchange an API token for a session for a target user.
    ///
    /// The API token must belong to an admin user.
    /// The target user's email is used to generate the session.
    ///
    /// Sentinel v1.3.0+: Requires display_name and optionally avatar_url for federated user creation.
    pub async fn exchange_token(
        &self,
        api_token: &str,
        email: &str,
        display_name: &str,
        avatar_url: Option<&str>,
    ) -> Result<TokenExchangeResponse> {
        let url = format!("{}/v1/api/auth/token/exchange", self.inner.base_url);

        let request = TokenExchangeRequest {
            email: email.to_string(),
            display_name: display_name.to_string(),
            avatar_url: avatar_url.map(|s| s.to_string()),
        };

        let response = self
            .inner
            .http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let envelope: crate::types::ApiEnvelope<crate::types::TokenExchangeResponse> =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;

            if !envelope.success {
                let error = envelope.error.ok_or_else(|| SentinelError::Api {
                    message: "Unknown error".to_string(),
                    code: crate::errors::SentinelErrorCode::Unknown,
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id.clone()),
                })?;
                return Err(SentinelError::Api {
                    message: error.message,
                    code: crate::errors::SentinelErrorCode::from_status(status.as_u16()),
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id),
                });
            }

            envelope.data.ok_or_else(|| SentinelError::Api {
                message: "No data in response".to_string(),
                code: crate::errors::SentinelErrorCode::Unknown,
                status: status.as_u16(),
                request_id: Some(envelope.request_id),
            })
        } else {
            Err(SentinelError::from_response(status.as_u16(), &body, None))
        }
    }

    /// Refresh an access token using a refresh token.
    ///
    /// POST /v1/api/auth/token/refresh
    pub async fn refresh_token(
        &self,
        _user_id: &str,
        refresh_token: &str,
    ) -> Result<RefreshTokenResponse> {
        let url = format!("{}/v1/api/auth/token/refresh", self.inner.base_url);

        let request = RefreshTokenRequest {
            refresh_token: refresh_token.to_string(),
        };

        let response = self
            .inner
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(SentinelError::Network)?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let envelope: crate::types::ApiEnvelope<crate::types::RefreshTokenResponse> =
                serde_json::from_str(&body).map_err(SentinelError::Parse)?;

            if !envelope.success {
                let error = envelope.error.ok_or_else(|| SentinelError::Api {
                    message: "Unknown error".to_string(),
                    code: crate::errors::SentinelErrorCode::Unknown,
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id.clone()),
                })?;
                return Err(SentinelError::Api {
                    message: error.message,
                    code: crate::errors::SentinelErrorCode::from_status(status.as_u16()),
                    status: status.as_u16(),
                    request_id: Some(envelope.request_id),
                });
            }

            envelope.data.ok_or_else(|| SentinelError::Api {
                message: "No data in response".to_string(),
                code: crate::errors::SentinelErrorCode::Unknown,
                status: status.as_u16(),
                request_id: Some(envelope.request_id),
            })
        } else {
            Err(SentinelError::from_response(status.as_u16(), &body, None))
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
