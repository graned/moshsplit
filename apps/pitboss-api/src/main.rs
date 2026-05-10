//! pitboss-api binary entry point.
//!
//! Reads configuration from environment variables, initialises the
//! application (database pool, migrations, services), and starts the
//! HTTP server with graceful shutdown support.

use pitboss_api::http::app::build_app;
use pitboss_api::http::server::HttpServer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load `.env` file if present (for local development).
    dotenvy::dotenv().ok();

    // Initialise structured logging.
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .pretty()
        .init();

    // Read the database URL from the environment.
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Build the fully-wired application.
    let router = build_app(&db_url).await?;

    // Start serving.
    let server = HttpServer::new(router);
    server.start().await.expect("Failed to start server");
    Ok(())
}
