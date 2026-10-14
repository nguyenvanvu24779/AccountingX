use axum::Json;

use codexia_codex::browser_health::{self, BrowserHealth};

use crate::types::ErrorResponse;

/// Read-only readiness check for browser-use; see `browser_health`.
pub(crate) async fn api_browser_health() -> Result<Json<BrowserHealth>, ErrorResponse> {
    let home = codexia_codex::runtime::effective_codex_home();
    tokio::task::spawn_blocking(move || browser_health::check(&home))
        .await
        .map(Json)
        .map_err(|e| ErrorResponse { error: format!("Browser check failed: {e}") })
}
