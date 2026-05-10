//! HTTP server — binds to a TCP socket and serves the Axum router
//! with graceful shutdown.

use axum::Router;
use tokio::net::TcpListener;
use tracing::info;

/// Default listen address.
const DEFAULT_HOST: &str = "0.0.0.0";
const DEFAULT_PORT: u16 = 8080;

/// Thin wrapper around the Axum serve loop.
pub struct HttpServer {
    router: Router,
    host: String,
    port: u16,
}

impl HttpServer {
    /// Create a new server with the provided router.
    pub fn new(router: Router) -> Self {
        let host = std::env::var("HOST").unwrap_or_else(|_| DEFAULT_HOST.to_string());
        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DEFAULT_PORT);

        Self { router, host, port }
    }

    /// Start serving, listening on `HOST:PORT` (default `0.0.0.0:8080`).
    ///
    /// Blocks on a signal for graceful shutdown (SIGINT / SIGTERM).
    pub async fn start(self) -> anyhow::Result<()> {
        let addr = format!("{}:{}", self.host, self.port);
        let listener = TcpListener::bind(&addr).await?;

        info!("HttpServer listening on {}", addr);

        // axum 0.8 uses `axum::serve` with a TcpListener.
        axum::serve(listener, self.router)
            .with_graceful_shutdown(shutdown_signal())
            .await?;

        info!("HttpServer shut down gracefully");
        Ok(())
    }
}

/// Waits for SIGINT or SIGTERM to trigger graceful shutdown.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
