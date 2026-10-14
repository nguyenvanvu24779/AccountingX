use axum::{Json, extract::State as AxumState};
use serde::{Deserialize, Serialize};

use codexia_db::zalo_approvers::ZaloApprover;

use crate::types::{ErrorResponse, WebServerState};
use crate::zalo_state::ZaloAccount;

fn err(e: String) -> ErrorResponse {
    ErrorResponse { error: e }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ZaloStatus {
    connected: bool,
    /// A login is under way: the sidecar is running and not yet logged in.
    connecting: bool,
    /// Name shown on the phone that scanned the QR, while it waits for approval.
    qr_scanned_by: Option<String>,
    account: Option<ZaloAccount>,
    qr_path: Option<String>,
    last_error: Option<String>,
}

pub(crate) async fn api_zalo_connect(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<ZaloStatus>, ErrorResponse> {
    crate::zalo_routing::start_zalo(&state).await.map_err(err)?;
    status(&state).await
}

pub(crate) async fn api_zalo_disconnect(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<ZaloStatus>, ErrorResponse> {
    state.zalo_state.reset_login().await;
    status(&state).await
}

pub(crate) async fn api_zalo_status(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<ZaloStatus>, ErrorResponse> {
    status(&state).await
}

async fn status(state: &WebServerState) -> Result<Json<ZaloStatus>, ErrorResponse> {
    Ok(Json(ZaloStatus {
        connected: state.zalo_state.is_connected(),
        connecting: !state.zalo_state.is_connected()
            && state.zalo_state.sidecar.lock().await.is_some(),
        qr_scanned_by: state.zalo_state.qr_scanned_by.lock().await.clone(),
        account: state.zalo_state.account.lock().await.clone(),
        qr_path: state.zalo_state.qr_path.lock().await.clone(),
        last_error: state.zalo_state.last_error.lock().await.clone(),
    }))
}

// Adding or removing approvers is not exposed here: whoever can edit the
// whitelist can approve tickets over Zalo, and an agent's shell can reach this
// API. The desktop UI manages approvers through Tauri commands instead.

pub(crate) async fn api_zalo_list_approvers() -> Result<Json<Vec<ZaloApprover>>, ErrorResponse> {
    codexia_db::zalo_approvers::list_approvers().map(Json).map_err(err)
}

#[derive(Deserialize)]
pub(crate) struct SendMessageParams {
    /// A Zalo user id or display name from the approver list.
    to: String,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SendMessageResult {
    sent_to: String,
}

/// Message someone on the approver list. Anything on this machine, including
/// an agent's shell, can reach this route, so the limits (whitelist, length,
/// rate) are enforced inside `zalo_notify`, not by the caller.
pub(crate) async fn api_zalo_send(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<SendMessageParams>,
) -> Result<Json<SendMessageResult>, ErrorResponse> {
    let approvers = codexia_db::zalo_approvers::list_approvers().map_err(err)?;
    let recipient =
        crate::zalo_notify::send_to_approver(&state.zalo_state, &approvers, &params.to, &params.text)
            .await
            .map_err(err)?;
    Ok(Json(SendMessageResult { sent_to: recipient.display_name }))
}
