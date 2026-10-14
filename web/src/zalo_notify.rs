//! Outgoing Zalo messages.
//!
//! The AI can message people through the local API, so this is where the limits
//! live, enforced in Rust where a raw `curl` from an agent's shell is held to
//! them too: only people on the approver whitelist can receive a message, text
//! is length-capped, and sending is rate-limited so a looping agent cannot
//! flood the team's phones.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use codexia_db::approvals::ApprovalTicket;
use codexia_db::zalo_approvers::ZaloApprover;

use crate::zalo_state::ZaloState;

const MAX_MESSAGE_CHARS: usize = 1500;
const RATE_WINDOW: Duration = Duration::from_secs(10 * 60);
const RATE_MAX_MESSAGES: usize = 20;
/// Shown at the start of every message so recipients know it came from the app.
const MESSAGE_PREFIX: &str = "[AccountingX] ";

/// Sliding-window limit on messages sent per recipient set.
#[derive(Default)]
pub struct SendLimiter {
    sent: VecDeque<Instant>,
}

impl SendLimiter {
    fn allow(&mut self, now: Instant) -> bool {
        while self.sent.front().is_some_and(|t| now.duration_since(*t) > RATE_WINDOW) {
            self.sent.pop_front();
        }
        if self.sent.len() >= RATE_MAX_MESSAGES {
            return false;
        }
        self.sent.push_back(now);
        true
    }
}

/// Find a whitelisted person by Zalo user id or, failing that, display name
/// (case-insensitive). Names that match several people are rejected rather
/// than guessed.
pub fn resolve_recipient(approvers: &[ZaloApprover], to: &str) -> Result<ZaloApprover, String> {
    let to = to.trim();
    if let Some(found) = approvers.iter().find(|a| a.zalo_user_id == to) {
        return Ok(found.clone());
    }
    let wanted = to.to_lowercase();
    let by_name: Vec<&ZaloApprover> = approvers
        .iter()
        .filter(|a| a.display_name.trim().to_lowercase() == wanted)
        .collect();
    match by_name.as_slice() {
        [one] => Ok((*one).clone()),
        [] => Err(format!(
            "`{to}` is not on the Zalo approver list. Messages can only go to people registered in Settings > Zalo."
        )),
        _ => Err(format!("More than one approver is named `{to}`; use their Zalo ID.")),
    }
}

/// Send `text` to a whitelisted person.
pub async fn send_to_approver(
    zalo_state: &ZaloState,
    approvers: &[ZaloApprover],
    to: &str,
    text: &str,
) -> Result<ZaloApprover, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("The message is empty.".to_string());
    }
    if text.chars().count() > MAX_MESSAGE_CHARS {
        return Err(format!("The message is longer than {MAX_MESSAGE_CHARS} characters."));
    }
    let recipient = resolve_recipient(approvers, to)?;

    let sidecar = zalo_state
        .sidecar
        .lock()
        .await
        .clone()
        .filter(|_| zalo_state.is_connected())
        .ok_or_else(|| "Zalo is not connected. Connect it in Settings > Zalo.".to_string())?;

    if !zalo_state.send_limiter.lock().await.allow(Instant::now()) {
        return Err(format!(
            "Too many Zalo messages (limit {RATE_MAX_MESSAGES} per {} minutes). Try again later.",
            RATE_WINDOW.as_secs() / 60
        ));
    }

    sidecar
        .send_message(&recipient.zalo_user_id, "User", &format!("{MESSAGE_PREFIX}{text}"))
        .await?;
    Ok(recipient)
}

/// How a new approval ticket is announced to the people who can decide it.
pub fn approval_request_text(ticket: &ApprovalTicket) -> String {
    let mut text = format!("Cần duyệt: {}", ticket.summary);
    if let Some(serde_json::Value::Object(fields)) = &ticket.payload {
        for (key, value) in fields {
            let value = match value {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            let shown: String = value.chars().take(300).collect();
            let ellipsis = if value.chars().count() > 300 { "…" } else { "" };
            text.push_str(&format!("\n- {key}: {shown}{ellipsis}"));
        }
    }
    text.push_str(&format!(
        "\nTrả lời \"{code} duyệt\" hoặc \"{code} từ chối\".",
        code = ticket.short_code
    ));
    text
}

/// Tell every approver who may decide tickets about a new one. Failures are
/// logged, not returned: the ticket exists and can still be decided in the app.
pub async fn notify_approvers_of_ticket(zalo_state: &ZaloState, ticket: &ApprovalTicket) {
    if !zalo_state.is_connected() {
        return;
    }
    let approvers = match codexia_db::zalo_approvers::list_approvers() {
        Ok(list) => list,
        Err(e) => {
            log::warn!("zalo: could not list approvers to notify: {e}");
            return;
        }
    };
    let text = approval_request_text(ticket);
    for approver in approvers.iter().filter(|a| a.can_approve) {
        if let Err(e) = send_to_approver(zalo_state, &approvers, &approver.zalo_user_id, &text).await {
            log::warn!("zalo: could not notify {} of ticket {}: {e}", approver.display_name, ticket.short_code);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn person(id: &str, name: &str) -> ZaloApprover {
        ZaloApprover {
            zalo_user_id: id.into(),
            display_name: name.into(),
            bot_id: None,
            can_approve: true,
            can_command: false,
            created_at: String::new(),
        }
    }

    #[test]
    fn recipients_resolve_by_id_or_unique_name_and_nothing_else() {
        let list = vec![person("1", "Lan"), person("2", "Tâm"), person("3", "tâm")];
        assert_eq!(resolve_recipient(&list, "1").unwrap().display_name, "Lan");
        assert_eq!(resolve_recipient(&list, " lan ").unwrap().zalo_user_id, "1");
        assert!(resolve_recipient(&list, "Tâm").unwrap_err().contains("more than one")
            || resolve_recipient(&list, "Tâm").unwrap_err().contains("More than one"));
        assert!(resolve_recipient(&list, "999").unwrap_err().contains("not on the Zalo approver list"));
    }

    #[test]
    fn limiter_blocks_after_the_cap_and_recovers_after_the_window() {
        let mut limiter = SendLimiter::default();
        let start = Instant::now();
        for _ in 0..RATE_MAX_MESSAGES {
            assert!(limiter.allow(start));
        }
        assert!(!limiter.allow(start));
        assert!(limiter.allow(start + RATE_WINDOW + Duration::from_secs(1)));
    }

    #[test]
    fn approval_text_shows_the_real_content_and_how_to_answer() {
        let ticket = ApprovalTicket {
            id: "t".into(),
            short_code: "482913".into(),
            kind: codexia_db::approvals::ApprovalKind::EmailSend,
            company_id: None,
            summary: "Gửi hóa đơn".into(),
            payload: Some(serde_json::json!({ "to": "a@example.com", "body": "x".repeat(400) })),
            evidence: vec![],
            status: codexia_db::approvals::ApprovalStatus::Pending,
            requested_by: None,
            approver_id: None,
            created_at: String::new(),
            resolved_at: None,
            consumed_at: None,
        };
        let text = approval_request_text(&ticket);
        assert!(text.contains("Gửi hóa đơn"));
        assert!(text.contains("a@example.com"));
        assert!(text.contains('…'), "long fields are cut");
        assert!(text.contains("482913 duyệt") && text.contains("482913 từ chối"));
    }
}
