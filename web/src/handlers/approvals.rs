//! Approval tickets over the local HTTP API.
//!
//! Anything on this machine can reach these routes — including an agent's
//! shell — so they only let a caller *ask* for approval, list what is
//! waiting, and *spend* an approval a person already gave. Deciding a ticket
//! is deliberately not here: the desktop UI does that through a Tauri
//! command, and Zalo approvers through the in-process Zalo handler.

use axum::Json;
use serde::Deserialize;
use serde_json::Value;

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
    /// The exact action being approved; required to spend the approval later.
    #[serde(default)]
    pub payload: Option<Value>,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
    #[serde(default)]
    pub requested_by: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsumeApprovalParams {
    pub short_code: String,
    pub kind: ApprovalKind,
    pub payload: Value,
}

pub(crate) async fn api_create_approval(
    Json(params): Json<CreateApprovalParams>,
) -> Result<Json<ApprovalTicket>, ErrorResponse> {
    codexia_db::approvals::create_approval(
        params.kind,
        params.company_id.as_deref(),
        &params.summary,
        params.payload.as_ref(),
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

/// Spend an approval right before acting on it — see
/// [`codexia_db::approvals::consume_approval`].
pub(crate) async fn api_consume_approval(
    Json(params): Json<ConsumeApprovalParams>,
) -> Result<Json<ApprovalTicket>, ErrorResponse> {
    codexia_db::approvals::consume_approval(&params.short_code, params.kind, &params.payload)
        .map(Json)
        .map_err(err)
}
