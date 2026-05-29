use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// A single user in the user list response.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserListItem {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
}
