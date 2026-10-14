//! What happens when a message arrives from Zalo.
//!
//! Called as the sidecar's notification handler (see `zalo_state.rs` /
//! `handlers/zalo.rs`). Every branch checks the whitelist first — a sender
//! this app has never been told about is logged and nothing else: their
//! text is data, never a command, same as a web page's content is never an
//! instruction.

use std::sync::{Arc, LazyLock};

use codexia_shared::zalo::ZaloSidecar;
use regex::Regex;
use serde_json::Value;

use crate::types::WebServerState;
use crate::zalo_state::{ZaloAccount, ZaloState};

static APPROVAL_REPLY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(\d{6})\s*(duy[eê]t|t[uừ]\s*ch[oố]i)\s*$").expect("valid regex")
});

fn session_dir() -> Result<std::path::PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or_else(|| "Cannot find home directory".to_string())?
        .join(".accountingx")
        .join("zalo"))
}

/// Start the Zalo sidecar and begin logging in: with the saved session when it
/// still works, otherwise by showing a QR code. Does nothing if it is already
/// running.
pub async fn start_zalo(state: &WebServerState) -> Result<(), String> {
    if state.zalo_state.sidecar.lock().await.is_some() {
        return Ok(());
    }
    // A fresh attempt: no QR, error or account left over from an earlier one.
    state.zalo_state.reset_login().await;

    let script = codexia_shared::zalo::resolve_sidecar_script()
        .ok_or_else(|| "Zalo sidecar script (bots/zalo/index.js) was not found.".to_string())?;

    let handler_state = state.clone();
    let on_notification = Arc::new(move |method: String, params: Value| {
        handle_notification(method, params, handler_state.clone());
    });

    let sidecar = Arc::new(ZaloSidecar::spawn(&script, &session_dir()?, on_notification).await?);
    sidecar.start().await?;
    *state.zalo_state.sidecar.lock().await = Some(sidecar);
    Ok(())
}

/// Reconnect at app start when a usable session was saved, so the bot is
/// reachable (and the AI's Zalo tools work) without anyone opening Settings.
/// Never shows a QR: with no saved session the user connects by hand.
pub async fn resume_zalo_if_saved(state: &WebServerState) {
    let saved = session_dir()
        .ok()
        .map(|dir| dir.join("session.json"))
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .is_some_and(|session| session["imei"].is_string() && session["userAgent"].is_string());
    if !saved {
        return;
    }
    if let Err(e) = start_zalo(state).await {
        log::warn!("zalo: could not resume the saved session: {e}");
    }
}

pub fn handle_notification(method: String, params: Value, state: WebServerState) {
    let zalo_state = Arc::clone(&state.zalo_state);
    match method.as_str() {
        "qr" => {
            if let Some(path) = params.get("path").and_then(Value::as_str) {
                let path = path.to_string();
                tokio::spawn(async move {
                    *zalo_state.qr_path.lock().await = Some(path);
                });
            }
        }
        "loggedIn" => {
            zalo_state.connected.store(true, std::sync::atomic::Ordering::Relaxed);
            let account = params
                .get("account")
                .and_then(|a| serde_json::from_value::<ZaloAccount>(a.clone()).ok());
            tokio::spawn(async move {
                *zalo_state.qr_path.lock().await = None;
                *zalo_state.qr_scanned_by.lock().await = None;
                *zalo_state.last_error.lock().await = None;
                *zalo_state.account.lock().await = account;
            });
        }
        "qrScanned" => {
            let name = params
                .get("displayName")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            tokio::spawn(async move {
                *zalo_state.qr_scanned_by.lock().await = Some(name);
            });
        }
        "loginFailed" => {
            // The login ended without success (QR expired or was declined):
            // stop the sidecar so the next Connect starts from a clean slate
            // and a fresh QR, instead of leaving a dead QR on screen.
            let reason = params
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("failed")
                .to_string();
            tokio::spawn(async move {
                zalo_state.reset_login().await;
                *zalo_state.last_error.lock().await = Some(reason);
            });
        }
        "loggedOut" => {
            zalo_state.connected.store(false, std::sync::atomic::Ordering::Relaxed);
            tokio::spawn(async move {
                *zalo_state.account.lock().await = None;
            });
        }
        "error" => {
            // Diagnostics only. What the user needs to know arrives as
            // `loginFailed`; showing every internal hiccup (e.g. "saved session
            // expired, falling back to QR") would just be noise.
            log::warn!("zalo sidecar error: {params}");
        }
        "message" => handle_message(params, state),
        other => log::warn!("zalo sidecar: unhandled notification `{other}`"),
    }
}

fn handle_message(params: Value, state: WebServerState) {
    let zalo_state = Arc::clone(&state.zalo_state);
    let Some(sender_id) = params.get("senderId").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let Some(text) = params.get("text").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let Some(thread_id) = params.get("threadId").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let sender_name = params
        .get("senderName")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let thread_type = params
        .get("threadType")
        .and_then(Value::as_str)
        .unwrap_or("User")
        .to_string();

    tokio::spawn(async move {
        let approver = match codexia_db::zalo_approvers::get_approver(&sender_id) {
            Ok(Some(approver)) => approver,
            Ok(None) => {
                // Strangers can only pair with a code; anything else is ignored.
                if let Some(answer) =
                    crate::zalo_pairing::handle_unregistered_sender(&sender_id, &sender_name, &text)
                {
                    send_reply(&zalo_state, &thread_id, &thread_type, &answer).await;
                } else {
                    log::info!("zalo: message from unregistered sender {sender_id}, ignoring");
                }
                return;
            }
            Err(e) => {
                log::warn!("zalo: could not check whitelist: {e}");
                return;
            }
        };

        // A ticket answered with its code ("482913 duyệt").
        if let Some(captures) = APPROVAL_REPLY.captures(&text) {
            let answer = if !approver.can_approve {
                "Bạn chưa có quyền duyệt.".to_string()
            } else {
                let code = &captures[1];
                let approve = captures[2].to_lowercase().starts_with("duy");
                match codexia_db::approvals::respond_approval(code, approve, Some(&sender_id)) {
                    Ok(ticket) => format!(
                        "Đã {} phiếu {}: {}",
                        if approve { "duyệt" } else { "từ chối" },
                        ticket.short_code,
                        ticket.summary
                    ),
                    Err(e) => format!("Không xử lý được mã này: {e}"),
                }
            };
            send_reply(&zalo_state, &thread_id, &thread_type, &answer).await;
            return;
        }

        // Anyone on the list is trusted: everything else is a message for the AI.
        crate::zalo_agent::handle_user_message(
            &state,
            &sender_id,
            approver.can_approve,
            thread_id,
            thread_type,
            text,
        )
        .await;
    });
}

async fn send_reply(zalo_state: &ZaloState, thread_id: &str, thread_type: &str, text: &str) {
    let sidecar = zalo_state.sidecar.lock().await.clone();
    if let Some(sidecar) = sidecar
        && let Err(e) = sidecar.send_message(thread_id, thread_type, text).await
    {
        log::warn!("zalo: could not send reply: {e}");
    }
}
