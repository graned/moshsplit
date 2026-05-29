use std::sync::Arc;

use axum::extract::State;
use axum::Json;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::user_dtos::UserListItem;
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;

/// GET /v1/users — list active users who are members of at least one event.
#[utoipa::path(
    get,
    path = "/v1/users",
    responses(
        (status = 200, description = "List of active users", body = Vec<UserListItem>),
    ),
    tag = "Users"
)]
pub async fn list_users(
    State(state): State<Arc<AppState>>,
    CurrentUser(_user_id): CurrentUser,
) -> Result<Json<Vec<UserListItem>>, ServiceError> {
    let member_ids = state.db_client.get_moshsplit_user_ids()?;
    let rows = state.sentinel_auth_client.list_users(&member_ids)?;

    let users: Vec<UserListItem> = rows
        .into_iter()
        .map(|r| UserListItem {
            id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
        })
        .collect();

    Ok(Json(users))
}
