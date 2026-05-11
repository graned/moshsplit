//! Sentinel Client - Rust SDK for Sentinel Auth service.
//!
//! This crate provides a client for interacting with the Sentinel Auth service,
//! including token validation for middleware integration.
//!
//! ## Quick Start
//!
//! ```rust
//! use sentinel_client::{SentinelClient, SentinelConfig};
//!
//! // Create client
//! let client = SentinelClient::new(SentinelConfig::new("http://localhost:9000"))?;
//!
//! // Validate a token
//! let user = client.authenticate("Bearer <token>").await?;
//! println!("Authenticated user: {}", user.user_id);
//! ```
//!
//! ## Middleware Integration
//!
//! For Axum middleware integration, use the `AuthMiddleware`:
//!
//! ```rust
//! use sentinel_client::{AuthMiddleware, SentinelClient, SentinelConfig};
//!
//! let sentinel = SentinelClient::new(SentinelConfig::default())?;
//! let auth = AuthMiddleware::new(sentinel);
//! ```
//!
//! ## Error Handling
//!
//! The crate provides a comprehensive error hierarchy matching the TypeScript SDK:
//!
//! ```rust
//! use sentinel_client::SentinelError;
//!
//! match error {
//!     SentinelError::Api { code, message, .. } => {
//!         match code {
//!             SentinelErrorCode::InvalidToken => { /* Handle invalid token */ }
//!             SentinelErrorCode::RateLimitExceeded => { /* Handle rate limit */ }
//!             _ => { /* Handle other errors */ }
//!         }
//!     }
//!     SentinelError::Network(e) => { /* Handle network errors */ }
//!     _ => { /* Handle other errors */ }
//! }
//! ```

pub mod client;
pub mod errors;
pub mod middleware;
pub mod types;

// Re-export main types
pub use client::{SentinelClient, SentinelClientBuilder};
pub use errors::{SentinelError, SentinelErrorCode, Result};
pub use middleware::AuthMiddleware;
pub use types::{AuthenticatedUser, SentinelConfig};

/// Current version of the crate.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");