//! Decisions only a person may make, reachable only from the app's own webview.
//!
//! These deliberately have no route on the local HTTP server: anything on this
//! machine can call that server — including an agent's shell — and an agent
//! must never be able to approve its own ticket or add itself as an approver.

use codexia_db::approvals::ApprovalTicket;
use codexia_db::zalo_approvers::ZaloApprover;
use codexia_db::zalo_pairings::ZaloPairing;

/// Recorded as the approver when someone decides in the desktop app.
const LOCAL_APPROVER: &str = "desktop";

#[tauri::command]
pub async fn approval_respond(short_code: String, approve: bool) -> Result<ApprovalTicket, String> {
    codexia_db::approvals::respond_approval(&short_code, approve, Some(LOCAL_APPROVER))
}

#[tauri::command]
pub async fn zalo_add_approver(
    zalo_user_id: String,
    display_name: String,
    bot_id: Option<String>,
    can_approve: Option<bool>,
    can_command: Option<bool>,
) -> Result<ZaloApprover, String> {
    codexia_db::zalo_approvers::add_approver(
        &zalo_user_id,
        &display_name,
        bot_id.as_deref(),
        can_approve.unwrap_or(true),
        can_command.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn zalo_remove_approver(zalo_user_id: String) -> Result<(), String> {
    codexia_db::zalo_approvers::remove_approver(&zalo_user_id)
}

/// A code a person can message to the bot to be added to the approver list.
/// Human-only like the other approver edits: a code is a way into the list.
#[tauri::command]
pub async fn zalo_create_pairing(
    can_approve: Option<bool>,
    can_command: Option<bool>,
) -> Result<ZaloPairing, String> {
    codexia_db::zalo_pairings::create_pairing(can_approve.unwrap_or(true), can_command.unwrap_or(false))
}

#[tauri::command]
pub async fn zalo_cancel_pairing(code: String) -> Result<(), String> {
    codexia_db::zalo_pairings::cancel_pairing(&code)
}

/// Choose whether the AI's ordinary requests are answered automatically. Human
/// only, like the other safety decisions in this file.
#[tauri::command]
pub async fn permission_mode_set(mode: codexia_codex::permissions::PermissionMode) -> Result<(), String> {
    codexia_codex::permissions::set_mode(mode)
}
