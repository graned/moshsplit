use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::domain::repositories::credit_repo::CreditRepository;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::credit_dtos::{
    ConvertCreditRequest, CreditResponse, CreditSummary, CreateCreditRequest,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::services::credit_service::CreditService;

fn make_svc(state: &AppState) -> CreditService {
    CreditService::new(
        EventRepository::new(state.db_client.clone()),
        CreditRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    )
}

/// POST /v1/events/:id/credits — create a new credit.
pub async fn create_credit(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(_user_id): CurrentUser,
    Json(req): Json<CreateCreditRequest>,
) -> Result<Json<CreditResponse>, ServiceError> {
    let svc = make_svc(&state);

    let credit = svc.create_credit(
        event_id,
        req.creditor_id,
        req.debtor_id,
        req.amount_cents,
        req.source_expense_id,
    )?;

    Ok(Json(CreditResponse {
        id: credit.id,
        event_id: credit.event_id,
        creditor_id: credit.creditor_id,
        debtor_id: credit.debtor_id,
        amount_cents: credit.amount_cents,
        amount_used_cents: credit.amount_used_cents,
        source_expense_id: credit.source_expense_id,
        status: credit.status.to_string(),
        version: credit.version,
        parent_credit_id: credit.parent_credit_id,
        created_at: credit.created_at,
        updated_at: credit.updated_at,
    }))
}

/// GET /v1/events/:id/credits — get available credits between two users.
pub async fn get_available_credits(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<GetCreditsParams>,
) -> Result<Json<Vec<CreditResponse>>, ServiceError> {
    let svc = make_svc(&state);

    let credits = svc.get_available_credits(event_id, params.debtor_id, params.creditor_id)?;

    Ok(Json(credits))
}

/// GET /v1/events/:id/credits/summary — get credit summary between two users.
pub async fn get_credit_summary(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<GetCreditsParams>,
) -> Result<Json<CreditSummary>, ServiceError> {
    let svc = make_svc(&state);

    let summary = svc.get_credit_summary(event_id, params.debtor_id, params.creditor_id)?;

    Ok(Json(summary))
}

/// POST /v1/events/:id/credits/:credit_id/convert — convert credit to payment.
pub async fn convert_credit_to_payment(
    State(state): State<Arc<AppState>>,
    Path((_event_id, credit_id)): Path<(Uuid, Uuid)>,
    CurrentUser(_user_id): CurrentUser,
    Json(req): Json<ConvertCreditRequest>,
) -> Result<Json<CreditResponse>, ServiceError> {
    let svc = make_svc(&state);

    let credit = svc.convert_credit_to_payment(credit_id, req.user_id)?;

    Ok(Json(CreditResponse {
        id: credit.id,
        event_id: credit.event_id,
        creditor_id: credit.creditor_id,
        debtor_id: credit.debtor_id,
        amount_cents: credit.amount_cents,
        amount_used_cents: credit.amount_used_cents,
        source_expense_id: credit.source_expense_id,
        status: credit.status.to_string(),
        version: credit.version,
        parent_credit_id: credit.parent_credit_id,
        created_at: credit.created_at,
        updated_at: credit.updated_at,
    }))
}

#[derive(Debug, serde::Deserialize)]
pub struct GetCreditsParams {
    pub debtor_id: Uuid,
    pub creditor_id: Uuid,
}
