use axum::Json;
use codexia_codex::permissions::{self, PermissionMode};
use serde::Serialize;

#[derive(Serialize)]
pub(crate) struct PermissionModeResponse {
    mode: PermissionMode,
}

/// Reading the mode is harmless. Changing it is not exposed here: anything on
/// this machine, including an agent's shell, can reach this API, and an agent
/// must not be able to switch off its own questions. The desktop UI sets it
/// through a Tauri command.
pub(crate) async fn api_permission_mode() -> Json<PermissionModeResponse> {
    Json(PermissionModeResponse { mode: permissions::mode() })
}
