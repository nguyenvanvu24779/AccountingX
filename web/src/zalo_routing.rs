//! What happens when a message arrives from Zalo.
//!
//! Called as the sidecar's notification handler (see `zalo_state.rs` /
//! `handlers/zalo.rs`). Every branch checks the whitelist first — a sender
//! this app has never been told about is logged and nothing else: their
//! text is data, never a command, same as a web page's content is never an
//! instruction.

use std::sync::{Arc, LazyLock};

use codexia_acp::AcpState;
use regex::Regex;
use serde_json::Value;

use crate::zalo_state::ZaloState;

static APPROVAL_REPLY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(\d{6})\s*(duy[eê]t|t[uừ]\s*ch[oố]i)\s*$").expect("valid regex")
});

pub fn handle_notification(
    method: String,
    params: Value,
    zalo_state: Arc<ZaloState>,
    acp_state: Arc<AcpState>,
) {
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
            tokio::spawn(async move {
                *zalo_state.qr_path.lock().await = None;
            });
        }
        "loggedOut" => {
            zalo_state.connected.store(false, std::sync::atomic::Ordering::Relaxed);
        }
        "error" => {
            if let Some(message) = params.get("message").and_then(Value::as_str) {
                let message = message.to_string();
                log::warn!("zalo sidecar error: {message}");
                tokio::spawn(async move {
                    *zalo_state.last_error.lock().await = Some(message);
                });
            }
        }
        "message" => handle_message(params, zalo_state, acp_state),
        other => log::warn!("zalo sidecar: unhandled notification `{other}`"),
    }
}

fn handle_message(params: Value, zalo_state: Arc<ZaloState>, acp_state: Arc<AcpState>) {
    let Some(sender_id) = params.get("senderId").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let Some(text) = params.get("text").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let Some(thread_id) = params.get("threadId").and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let thread_type = params
        .get("threadType")
        .and_then(Value::as_str)
        .unwrap_or("User")
        .to_string();

    tokio::spawn(async move {
        let approver = match codexia_db::zalo_approvers::get_approver(&sender_id) {
            Ok(Some(approver)) => approver,
            Ok(None) => {
                log::info!("zalo: message from unregistered sender {sender_id}, ignoring");
                return;
            }
            Err(e) => {
                log::warn!("zalo: could not check whitelist: {e}");
                return;
            }
        };

        let reply = if let Some(captures) = APPROVAL_REPLY.captures(&text) {
            if !approver.can_approve {
                Some("Bạn chưa có quyền duyệt.".to_string())
            } else {
                let code = &captures[1];
                let approve = captures[2].to_lowercase().starts_with("duy");
                match codexia_db::approvals::respond_approval(code, approve, Some(&sender_id)) {
                    Ok(ticket) => Some(format!(
                        "Đã {} phiếu {}: {}",
                        if approve { "duyệt" } else { "từ chối" },
                        ticket.short_code,
                        ticket.summary
                    )),
                    Err(e) => Some(format!("Không xử lý được mã này: {e}")),
                }
            }
        } else if approver.can_command {
            match &approver.bot_id {
                None => Some("Bạn chưa được gán công ty để giao việc.".to_string()),
                Some(bot_id) => {
                    match acp_state.run_bot_unattended(bot_id, &text, None, false, |_| {}).await {
                        Ok(report) if !report.reply.is_empty() => Some(report.reply),
                        Ok(_) => Some("Đã xử lý, nhưng không có nội dung trả lời.".to_string()),
                        Err(e) => Some(format!("Có lỗi khi xử lý: {e}")),
                    }
                }
            }
        } else {
            None
        };

        if let Some(text) = reply {
            let sidecar = zalo_state.sidecar.lock().await.clone();
            if let Some(sidecar) = sidecar
                && let Err(e) = sidecar.send_message(&thread_id, &thread_type, &text).await
            {
                log::warn!("zalo: could not send reply: {e}");
            }
        }
    });
}
