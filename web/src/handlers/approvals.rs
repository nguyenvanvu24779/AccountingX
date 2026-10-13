use axum::Json;
use serde::Deserialize;

use codexia_db::approvals::{ApprovalKind, ApprovalTicket, EvidenceRef};

use crate::types::ErrorResponse;

fn err(e: String) -> ErrorResponse {
    ErrorResponse { error: e }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateApprovalParams {
    pub kind: ApprovalKind,
    #[serde(default)]
    pub company_id: Option<String>,
    pub summary: String,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
    #[serde(default)]
    pub requested_by: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RespondApprovalParams {
    pub short_code: String,
    pub approve: bool,
    #[serde(default)]
    pub approver_id: Option<String>,
}

pub(crate) async fn api_create_approval(
    Json(params): Json<CreateApprovalParams>,
) -> Result<Json<ApprovalTicket>, ErrorResponse> {
    codexia_db::approvals::create_approval(
        params.kind,
        params.company_id.as_deref(),
        &params.summary,
        &params.evidence,
        params.requested_by.as_deref(),
    )
    .map(Json)
    .map_err(err)
}

pub(crate) async fn api_list_pending_approvals() -> Result<Json<Vec<ApprovalTicket>>, ErrorResponse> {
    codexia_db::approvals::list_pending_approvals()
        .map(Json)
        .map_err(err)
}

pub(crate) async fn api_respond_approval(
    Json(params): Json<RespondApprovalParams>,
) -> Result<Json<ApprovalTicket>, ErrorResponse> {
    codexia_db::approvals::respond_approval(
        &params.short_code,
        params.approve,
        params.approver_id.as_deref(),
    )
    .map(Json)
    .map_err(err)
}
