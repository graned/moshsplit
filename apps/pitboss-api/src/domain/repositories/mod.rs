//! Repository traits and implementations.
//!
//! Each repository defines a trait (interface) in this module and a
//! concrete implementation in `infrastructure/persistence/`.
//!
//! Example:
//! ```ignore
//! #[async_trait]
//! pub trait EventRepository: Send + Sync {
//!     async fn find_by_id(&self, id: Uuid) -> Result<Event, RepositoryError>;
//!     async fn create(&self, event: NewEvent) -> Result<Event, RepositoryError>;
//! }
//! ```

// Placeholder for repository traits.
