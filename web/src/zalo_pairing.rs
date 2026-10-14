//! Adding a Zalo approver by pairing code (see `codexia_db::zalo_pairings`).
//!
//! A person the app has never heard of can only ever do one thing: send
//! `GHEP <code>` with a code someone created in the app minutes ago. Everything
//! else they send is ignored. Wrong codes are counted, and after a few the bot
//! stops answering pairing attempts for a while so a code cannot be guessed.

use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use regex::Regex;

static PAIRING_MESSAGE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^\s*gh[eé]p\s+(\d{6})\s*$").expect("valid regex"));

const MAX_FAILURES: usize = 5;
const FAILURE_WINDOW: Duration = Duration::from_secs(10 * 60);

static FAILURES: LazyLock<Mutex<Vec<Instant>>> = LazyLock::new(|| Mutex::new(Vec::new()));

/// The code in a `GHEP 123456` message, if that is what the text is.
pub fn pairing_code(text: &str) -> Option<String> {
    PAIRING_MESSAGE.captures(text).map(|c| c[1].to_string())
}

fn blocked(failures: &mut Vec<Instant>, now: Instant) -> bool {
    failures.retain(|t| now.duration_since(*t) < FAILURE_WINDOW);
    failures.len() >= MAX_FAILURES
}

/// What to answer a sender who is not on the approver list yet. `None` means
/// stay silent, which is the answer to everything except a pairing attempt.
pub fn handle_unregistered_sender(sender_id: &str, sender_name: &str, text: &str) -> Option<String> {
    let code = pairing_code(text)?;

    let mut failures = FAILURES.lock().unwrap_or_else(|e| e.into_inner());
    if blocked(&mut failures, Instant::now()) {
        log::warn!("zalo: too many wrong pairing codes, ignoring attempt from {sender_id}");
        return None;
    }

    match codexia_db::zalo_pairings::claim_pairing(&code) {
        Ok(Some(pairing)) => {
            let name = if sender_name.trim().is_empty() {
                let tail: String = sender_id.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
                format!("Zalo …{tail}")
            } else {
                sender_name.trim().to_string()
            };
            match codexia_db::zalo_approvers::add_approver(
                sender_id,
                &name,
                None,
                pairing.can_approve,
                pairing.can_command,
            ) {
                Ok(_) => Some(format!(
                    "Đã ghép thành công. Chào {name}! {}",
                    if pairing.can_approve {
                        "Khi có việc cần duyệt, bạn sẽ nhận tin ở đây — trả lời \"<mã> duyệt\" hoặc \"<mã> từ chối\"."
                    } else {
                        "Bạn đã được thêm vào danh sách."
                    }
                )),
                Err(e) => {
                    log::warn!("zalo: could not save the paired approver: {e}");
                    Some("Có lỗi khi ghép, vui lòng thử lại với mã mới.".to_string())
                }
            }
        }
        Ok(None) => {
            failures.push(Instant::now());
            Some("Mã không đúng hoặc đã hết hạn. Hãy xin mã mới trong ứng dụng AccountingX.".to_string())
        }
        Err(e) => {
            log::warn!("zalo: could not check the pairing code: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_well_formed_pairing_message_counts() {
        assert_eq!(pairing_code("GHEP 482913").as_deref(), Some("482913"));
        assert_eq!(pairing_code("  ghép   482913 ").as_deref(), Some("482913"));
        assert_eq!(pairing_code("Ghep 12345"), None);
        assert_eq!(pairing_code("xin chào, ghep 482913 nhé"), None);
        assert_eq!(pairing_code("482913 duyệt"), None);
    }

    #[test]
    fn guessing_is_cut_off_after_a_few_failures() {
        let now = Instant::now();
        let mut failures: Vec<Instant> = (0..MAX_FAILURES).map(|_| now).collect();
        assert!(blocked(&mut failures, now));
        assert!(!blocked(&mut failures, now + FAILURE_WINDOW + Duration::from_secs(1)));
        assert!(failures.is_empty(), "old failures are forgotten");
    }

    #[test]
    fn strangers_get_no_answer_to_anything_but_pairing() {
        assert_eq!(handle_unregistered_sender("1", "X", "Cho mình xem công nợ"), None);
    }
}
