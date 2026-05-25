//! Axum middlewares for request ID injection, response wrapping,
//! authentication, and other cross-cutting concerns.

pub mod admin_role_middleware;
pub mod cookie_auth;
pub mod request_id_middleware;
pub mod response_wrapper;
