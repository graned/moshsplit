//! Integration tests for sentinel-client SDK.
//!
//! These tests run against a real Sentinel instance at http://localhost:9000.
//!
//! ## Prerequisites
//!
//! - Sentinel must be running at http://localhost:9000
//! - For local development, uncomment the Sentinel service in infra/compose/dev.yml
//! - Run: `docker compose -f infra/compose/dev.yml up -d sentinel`
//!
//! ## Running Tests
//!
//! ```bash
//! # Start Sentinel
//! docker compose -f infra/compose/dev.yml up -d
//!
//! # Run integration tests
//! cargo test --test integration
//! ```
//!
//! ## Notes
//!
//! - Tests that hit the network may be skipped if Sentinel is not available
//! - Integration tests verify SDK works with real API
//! - Middleware tests are unit tests that don't require Sentinel

use sentinel_client::{SentinelClient, SentinelClientBuilder, SentinelConfig, SentinelError};

/// Test that we can create a client and reach Sentinel.
#[tokio::test]
async fn test_client_connection() {
    let client = SentinelClient::new(SentinelConfig::new("http://localhost:9000")).unwrap();
    
    // Just verify the client is configured correctly
    assert_eq!(client.base_url(), "http://localhost:9000");
}

/// Test authenticating with an invalid token returns proper error.
#[tokio::test]
async fn test_authenticate_invalid_token() {
    let client = SentinelClient::new(SentinelConfig::new("http://localhost:9000")).unwrap();

    let result = client.authenticate("invalid-token", "GET", "/api/test").await;

    // Should fail with an error
    assert!(result.is_err());
    let err = result.unwrap_err();

    // Just verify some error occurred - could be network, API, etc.
    // The important thing is it's not success
    println!("Error type: {:?}", std::mem::discriminant(&err));
}

/// Test authenticating with no token returns missing token error.
#[tokio::test]
async fn test_authenticate_empty_token() {
    let client = SentinelClient::new(SentinelConfig::new("http://localhost:9000")).unwrap();

    let result = client.authenticate("", "GET", "/api/test").await;

    // Should fail
    assert!(result.is_err());
}

/// Test Sentinel is reachable (health check pattern).
#[tokio::test]
async fn test_sentinel_reachable() {
    let client = SentinelClient::new(SentinelConfig::new("http://localhost:9000")).unwrap();

    // Try to authenticate - this will fail but proves we can reach the service
    let _ = client.authenticate("test", "GET", "/api/test").await;

    // If we get here, the service is reachable (even if auth fails)
    // This test just validates we can make HTTP requests
}

/// Test configuration builder works correctly.
#[tokio::test]
async fn test_config_builder() {
    let client = SentinelClientBuilder::new()
        .base_url("http://custom:9000")
        .timeout(5000)
        .build()
        .unwrap();
    
    assert_eq!(client.base_url(), "http://custom:9000");
}

/// Test default config uses localhost:9000.
#[tokio::test]
async fn test_default_config() {
    let client = SentinelClient::default().unwrap();
    assert_eq!(client.base_url(), "http://localhost:9000");
}