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
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .pretty()
        .init();

    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    if std::env::args().any(|a| a == "--migrate") {
        let db_client = pitboss_api::infrastructure::clients::DbClient::new(&db_url)
            .map_err(|e| anyhow::anyhow!("Failed to connect to Postgres: {}", e))?;
        db_client
            .run_migrations()
            .map_err(|e| anyhow::anyhow!("Migration failed: {}", e))?;
        tracing::info!("Migrations complete — exiting");
        return Ok(());
    }

    let router = build_app(&db_url).await?;

    let server = HttpServer::new(router);
    server.start().await.expect("Failed to start server");
    Ok(())
}
