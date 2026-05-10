//! Use-case / application services.
//!
//! Each module orchestrates a single business use case, composing
//! domain logic with one or more repositories.
//!
//! Example:
//! ```ignore
//! pub struct CreateEventApplication {
//!     repo: Arc<dyn EventRepository>,
//!     member_repo: Arc<dyn EventMemberRepository>,
//! }
//!
//! impl CreateEventApplication {
//!     pub async fn execute(&self, cmd: CreateEventCommand) -> Result<Event, ServiceError> {
//!         // validate → domain logic → persist
//!     }
//! }
//! ```

// Placeholder for application services.
