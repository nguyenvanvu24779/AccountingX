use std::sync::Arc;

use axum::{Json, extract::State as AxumState};
use serde::{Deserialize, Serialize};

use codexia_db::zalo_approvers::ZaloApprover;
use codexia_shared::zalo::ZaloSidecar;

use crate::types::{ErrorResponse, WebServerState};
use crate::zalo_routing::handle_notification;

fn err(e: String) -> ErrorResponse {
    ErrorResponse { error: e }
}

fn zalo_session_dir() -> Result<std::path::PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or_else(|| "Cannot find home directory".to_string())?
        .join(".accountingx")
        .join("zalo"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ZaloStatus {
    connected: bool,
    qr_path: Option<String>,
    last_error: Option<String>,
}

pub(crate) async fn api_zalo_connect(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<ZaloStatus>, ErrorResponse> {
    {
        let existing = state.zalo_state.sidecar.lock().await;
        if existing.is_some() {
            return status(&state).await;
        }
    }

    let script = codexia_shared::zalo::resolve_sidecar_script().ok_or_else(|| {
        err("Zalo sidecar script (bots/zalo/index.js) was not found.".to_string())
    })?;
    let session_dir = zalo_session_dir().map_err(err)?;

    let zalo_state = Arc::clone(&state.zalo_state);
    let acp_state = Arc::clone(&state.acp_state);
    let on_notification = Arc::new(move |method: String, params: serde_json::Value| {
        handle_notification(method, params, Arc::clone(&zalo_state), Arc::clone(&acp_state));
    });

    let sidecar = ZaloSidecar::spawn(&script, &session_dir, on_notification)
        .await
        .map_err(err)?;
    let sidecar = Arc::new(sidecar);

    sidecar.start().await.map_err(err)?;

    *state.zalo_state.sidecar.lock().await = Some(sidecar);
    status(&state).await
}

pub(crate) async fn api_zalo_disconnect(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<ZaloStatus>, ErrorResponse> {
    let sidecar = state.zalo_state.sidecar.lock().await.take();
    if let Some(sidecar) = sidecar {
        sidecar.stop().await;
    }
    state
        .zalo_state
        .connected
        .store(false, std::sync::atomic::Ordering::Relaxed);
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
        qr_path: state.zalo_state.qr_path.lock().await.clone(),
        last_error: state.zalo_state.last_error.lock().await.clone(),
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AddApproverParams {
    zalo_user_id: String,
    display_name: String,
    #[serde(default)]
    bot_id: Option<String>,
    #[serde(default = "default_true")]
    can_approve: bool,
    #[serde(default)]
    can_command: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
pub(crate) struct ApproverIdParams {
    #[serde(rename = "zaloUserId")]
    zalo_user_id: String,
}

pub(crate) async fn api_zalo_list_approvers() -> Result<Json<Vec<ZaloApprover>>, ErrorResponse> {
    codexia_db::zalo_approvers::list_approvers().map(Json).map_err(err)
}

pub(crate) async fn api_zalo_add_approver(
    Json(params): Json<AddApproverParams>,
) -> Result<Json<ZaloApprover>, ErrorResponse> {
    codexia_db::zalo_approvers::add_approver(
        &params.zalo_user_id,
        &params.display_name,
        params.bot_id.as_deref(),
        params.can_approve,
        params.can_command,
    )
    .map(Json)
    .map_err(err)
}

pub(crate) async fn api_zalo_remove_approver(
    Json(params): Json<ApproverIdParams>,
) -> Result<Json<()>, ErrorResponse> {
    codexia_db::zalo_approvers::remove_approver(&params.zalo_user_id)
        .map(Json)
        .map_err(err)
}
