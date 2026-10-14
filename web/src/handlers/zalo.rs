use std::sync::Arc;

use axum::{Json, extract::State as AxumState};
use serde::Serialize;

use codexia_db::zalo_approvers::ZaloApprover;
use codexia_shared::zalo::ZaloSidecar;

use crate::types::{ErrorResponse, WebServerState};
use crate::zalo_routing::handle_notification;
use crate::zalo_state::ZaloAccount;

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
    account: Option<ZaloAccount>,
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
    *state.zalo_state.account.lock().await = None;
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
