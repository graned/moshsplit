//! pitboss-api binary entry point.
//!
//! Reads configuration from environment variables, initialises the
//! application (database pool, migrations, services), and starts the
//! HTTP server with graceful shutdown support.
//!
//! Flags:
//!   --migrate    Run pending database migrations and exit.

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

    // Build the fully-wired application (runs pending migrations).
    let router = build_app(&db_url).await?;

    // If only migrations were requested, exit.
    if std::env::args().any(|a| a == "--migrate") {
        tracing::info!("Migrations complete — exiting");
        return Ok(());
    }

    // Start serving.
    let server = HttpServer::new(router);
    server.start().await.expect("Failed to start server");
    Ok(())
}
