//! The text side of the Zalo <-> AI conversation: understanding short human
//! replies ("ok", "không", "công ty 2"), picking a company, and turning the AI's
//! Markdown answers and Codex's permission requests into plain chat messages.
//! Pure functions, so the behavior is tested without a phone or an AI.

use std::path::{Path, PathBuf};

use serde_json::{Value, json};

/// Zalo messages are cut at this length; longer answers are split.
pub const CHUNK_CHARS: usize = 1500;
const MAX_CHUNKS: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reply {
    /// "ok", "có", "đồng ý", "duyệt"...
    Yes,
    /// "ok luôn": yes, and don't ask again this session.
    YesAlways,
    /// "không", "từ chối"...
    No,
}

fn normalize(text: &str) -> String {
    text.trim()
        .trim_end_matches(['.', '!', ' '])
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// A short answer to a question the AI asked. Whole-message match only, so a
/// sentence that merely contains "ok" is a new instruction, not an answer.
pub fn parse_reply(text: &str) -> Option<Reply> {
    match normalize(text).as_str() {
        "ok" | "oke" | "okay" | "có" | "co" | "đồng ý" | "dong y" | "duyệt" | "duyet" | "được"
        | "duoc" | "yes" | "y" | "cho phép" | "cho phep" | "ừ" | "ok em" => Some(Reply::Yes),
        "ok luôn" | "ok luon" | "cho phép luôn" | "cho phep luon" | "đồng ý luôn" | "dong y luon"
        | "luôn" | "luon" => Some(Reply::YesAlways),
        "không" | "khong" | "ko" | "k" | "no" | "từ chối" | "tu choi" | "đừng" | "dung lai khong" => {
            Some(Reply::No)
        }
        _ => None,
    }
}

/// "dừng", "stop", "hủy": ask the AI to stop what it is doing.
pub fn is_stop(text: &str) -> bool {
    matches!(normalize(text).as_str(), "dừng" | "dung" | "dừng lại" | "dung lai" | "stop" | "hủy" | "huy")
}

/// In a group the bot only answers when it is spoken to: @mentioned, or the
/// message starts with "bot". Everything else is people talking to each other.
/// Returns the text to act on (without a leading "bot"), or `None` to stay quiet.
pub fn addressed_to_bot(text: &str, mentioned: bool) -> Option<String> {
    let trimmed = text.trim();
    let lower = trimmed.to_lowercase();
    for prefix in ["bot,", "bot:", "bot "] {
        if let Some(_rest) = lower.strip_prefix(prefix) {
            // Prefix is ASCII, so the same byte length applies to the original.
            let rest = trimmed[prefix.len()..].trim();
            return (!rest.is_empty()).then(|| rest.to_string());
        }
    }
    mentioned.then(|| trimmed.to_string())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Company {
    pub cwd: PathBuf,
    pub name: String,
    pub mst: String,
}

fn field(agents_md: &str, label: &str) -> String {
    agents_md
        .lines()
        .find_map(|line| line.trim().strip_prefix("- ")?.strip_prefix(label)?.strip_prefix(':'))
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}

/// Company workspaces under `<accountingx home>/companies/<mst>/` (each with an
/// AGENTS.md naming it), sorted by name so "công ty 1" is stable.
pub fn list_companies(companies_dir: &Path) -> Vec<Company> {
    let Ok(entries) = std::fs::read_dir(companies_dir) else {
        return Vec::new();
    };
    let mut found: Vec<Company> = entries
        .filter_map(Result::ok)
        .filter(|e| e.path().join("AGENTS.md").is_file())
        .map(|e| {
            let md = std::fs::read_to_string(e.path().join("AGENTS.md")).unwrap_or_default();
            let folder = e.file_name().to_string_lossy().into_owned();
            let name = field(&md, "Tên");
            let mst = field(&md, "Mã số thuế");
            Company {
                cwd: e.path(),
                name: if name.is_empty() { folder.clone() } else { name },
                mst: if mst.is_empty() { folder } else { mst },
            }
        })
        .collect();
    found.sort_by_key(|c| c.name.to_lowercase());
    found
}

/// "công ty 2" or "công ty 3603823640": the index of the company chosen.
pub fn parse_company_choice(text: &str, companies: &[Company]) -> Option<usize> {
    let normalized = normalize(text);
    let rest = normalized
        .strip_prefix("công ty ")
        .or_else(|| normalized.strip_prefix("cong ty "))?
        .trim();
    if let Some(by_mst) = companies.iter().position(|c| c.mst == rest) {
        return Some(by_mst);
    }
    let number: usize = rest.parse().ok()?;
    (1..=companies.len()).contains(&number).then(|| number - 1)
}

pub fn company_menu(companies: &[Company]) -> String {
    let mut text = String::from("Bạn muốn làm việc với công ty nào?");
    for (i, c) in companies.iter().enumerate() {
        text.push_str(&format!("\n{}. {} (MST {})", i + 1, c.name, c.mst));
    }
    text.push_str("\nTrả lời \"công ty 1\" (hoặc số tương ứng) để chọn.");
    text
}

/// Plain-text version of an AI answer for a chat bubble: no Markdown markers,
/// links reduced to their text, runs of blank lines collapsed.
pub fn tidy_for_chat(markdown: &str) -> String {
    let mut out = String::with_capacity(markdown.len());
    let mut chars = markdown.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '*' | '`' | '#' => {}
            '[' => {
                // [text](target) -> text
                let mut label = String::new();
                let mut closed = false;
                for next in chars.by_ref() {
                    if next == ']' {
                        closed = true;
                        break;
                    }
                    label.push(next);
                }
                if closed && chars.peek() == Some(&'(') {
                    for next in chars.by_ref() {
                        if next == ')' {
                            break;
                        }
                    }
                    out.push_str(&label);
                } else {
                    out.push('[');
                    out.push_str(&label);
                    if closed {
                        out.push(']');
                    }
                }
            }
            other => out.push(other),
        }
    }
    let mut collapsed = String::new();
    let mut blank_run = 0;
    for line in out.lines() {
        if line.trim().is_empty() {
            blank_run += 1;
            if blank_run > 1 {
                continue;
            }
        } else {
            blank_run = 0;
        }
        collapsed.push_str(line.trim_end());
        collapsed.push('\n');
    }
    collapsed.trim().to_string()
}

/// Split into chat-sized messages, breaking at line ends where possible, and
/// say so when the rest was left out.
pub fn chunk_for_chat(text: &str) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    for line in text.lines() {
        let mut line = line.to_string();
        while line.chars().count() > CHUNK_CHARS {
            let head: String = line.chars().take(CHUNK_CHARS).collect();
            line = line.chars().skip(CHUNK_CHARS).collect();
            if !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
            }
            chunks.push(head);
        }
        if current.chars().count() + line.chars().count() + 1 > CHUNK_CHARS && !current.is_empty() {
            chunks.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(&line);
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    if chunks.len() > MAX_CHUNKS {
        chunks.truncate(MAX_CHUNKS);
        if let Some(last) = chunks.last_mut() {
            last.push_str("\n… (còn tiếp, xem đầy đủ trong ứng dụng AccountingX)");
        }
    }
    chunks
}

/// What Codex is waiting on a person for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestKind {
    Command,
    FileChange,
    Elicitation,
    Permissions,
    UserInput,
}

pub fn request_kind(event: &str, params: &Value) -> Option<RequestKind> {
    match (event, params.get("type").and_then(Value::as_str)) {
        ("codex/approval-request", Some("commandExecution")) => Some(RequestKind::Command),
        ("codex/approval-request", Some("fileChange")) => Some(RequestKind::FileChange),
        ("codex/elicitation-request", _) => Some(RequestKind::Elicitation),
        ("codex/permissions-request", _) => Some(RequestKind::Permissions),
        ("codex/request-user-input", _) => Some(RequestKind::UserInput),
        _ => None,
    }
}

fn str_field<'a>(params: &'a Value, key: &str) -> Option<&'a str> {
    params.get(key).and_then(Value::as_str).filter(|s| !s.trim().is_empty())
}

const HOW_TO_ANSWER: &str = "Trả lời \"ok\" (một lần), \"ok luôn\" (không hỏi lại) hoặc \"không\".";

/// The question put to the person on Zalo.
pub fn request_question(kind: RequestKind, params: &Value) -> String {
    let why = str_field(params, "reason").map(|r| format!("\nLý do: {r}")).unwrap_or_default();
    match kind {
        RequestKind::Command => format!(
            "AI muốn chạy lệnh:\n{}{why}\n{HOW_TO_ANSWER}",
            str_field(params, "command").unwrap_or("(không rõ lệnh)")
        ),
        RequestKind::FileChange => format!("AI muốn sửa/tạo tệp trong thư mục công ty.{why}\n{HOW_TO_ANSWER}"),
        RequestKind::Permissions => {
            format!("AI xin thêm quyền (mạng hoặc truy cập tệp).{why}\n{HOW_TO_ANSWER}")
        }
        RequestKind::Elicitation => format!(
            "AI cần bạn xác nhận: {}\n{HOW_TO_ANSWER}",
            str_field(params, "message").unwrap_or("một thao tác trên trình duyệt/công cụ")
        ),
        RequestKind::UserInput => {
            let question = params
                .get("questions")
                .and_then(Value::as_array)
                .and_then(|q| q.first())
                .and_then(|q| str_field(q, "question"))
                .unwrap_or("AI cần thêm thông tin");
            format!("AI hỏi: {question}")
        }
    }
}

/// The JSON Codex expects back for a request, given the person's answer.
pub fn request_response(kind: RequestKind, params: &Value, reply: Reply) -> Value {
    let accept = reply != Reply::No;
    match kind {
        RequestKind::Command | RequestKind::FileChange => {
            let decision = match reply {
                Reply::Yes => "accept",
                Reply::YesAlways => "acceptForSession",
                Reply::No => "decline",
            };
            json!({ "decision": decision })
        }
        RequestKind::Elicitation => {
            json!({ "action": if accept { "accept" } else { "decline" }, "content": null, "_meta": null })
        }
        RequestKind::Permissions => json!({
            "permissions": if accept { params.get("permissions").cloned().unwrap_or(json!({})) } else { json!({}) },
            "scope": if reply == Reply::YesAlways { "session" } else { "turn" },
        }),
        // Answered with free text instead; see `user_input_response`.
        RequestKind::UserInput => json!({ "answers": {} }),
    }
}

/// The answer to a `request_user_input` question: the person's own words.
pub fn user_input_response(params: &Value, answer: &str) -> Option<Value> {
    let id = params.get("questions")?.as_array()?.first()?.get("id")?.as_str()?;
    Some(json!({ "answers": { id: { "answers": [answer.trim()] } } }))
}

/// A question the person must not answer over chat (passwords, codes).
pub fn user_input_is_secret(params: &Value) -> bool {
    params
        .get("questions")
        .and_then(Value::as_array)
        .and_then(|q| q.first())
        .and_then(|q| q.get("isSecret"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn companies() -> Vec<Company> {
        vec![
            Company { cwd: "a".into(), name: "An Phát".into(), mst: "111".into() },
            Company { cwd: "b".into(), name: "Trí Nhân".into(), mst: "3603823640".into() },
        ]
    }

    #[test]
    fn short_answers_are_recognized_but_sentences_are_not() {
        assert_eq!(parse_reply("OK"), Some(Reply::Yes));
        assert_eq!(parse_reply("  Có. "), Some(Reply::Yes));
        assert_eq!(parse_reply("ok luôn"), Some(Reply::YesAlways));
        assert_eq!(parse_reply("Không"), Some(Reply::No));
        assert_eq!(parse_reply("ok xem tồn kho giúp mình"), None);
        assert_eq!(parse_reply("không phải, xem công nợ"), None);
        assert!(is_stop("Dừng") && is_stop("stop") && !is_stop("dừng lại và xem công nợ"));
    }

    #[test]
    fn company_is_chosen_by_number_or_mst() {
        let list = companies();
        assert_eq!(parse_company_choice("Công ty 2", &list), Some(1));
        assert_eq!(parse_company_choice("công ty 3603823640", &list), Some(1));
        assert_eq!(parse_company_choice("công ty 3", &list), None);
        assert_eq!(parse_company_choice("xem tồn kho công ty 1", &list), None);
        assert!(company_menu(&list).contains("2. Trí Nhân (MST 3603823640)"));
    }

    #[test]
    fn companies_are_read_from_their_agents_md() {
        let dir = std::env::temp_dir().join(format!("accountingx-companies-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("3603823640")).unwrap();
        std::fs::write(
            dir.join("3603823640").join("AGENTS.md"),
            "# AGENTS.md\n\n## Công ty\n- Tên: Trí Nhân\n- Mã số thuế: 3603823640\n",
        )
        .unwrap();
        std::fs::create_dir_all(dir.join("not-a-company")).unwrap();

        let found = list_companies(&dir);
        assert_eq!(found.len(), 1);
        assert_eq!((found[0].name.as_str(), found[0].mst.as_str()), ("Trí Nhân", "3603823640"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn markdown_becomes_plain_chat_text() {
        let md = "**Tồn cuối kỳ:** 131.863.009 đ\n\n\n\n- `32` mặt hàng\n[Bảng CSV](C:/a/b.csv)";
        assert_eq!(
            tidy_for_chat(md),
            "Tồn cuối kỳ: 131.863.009 đ\n\n- 32 mặt hàng\nBảng CSV"
        );
    }

    #[test]
    fn long_answers_are_split_and_capped() {
        let line = "x".repeat(900);
        let text = format!("{line}\n{line}\n{line}");
        let chunks = chunk_for_chat(&text);
        assert_eq!(chunks.len(), 3);
        assert!(chunks.iter().all(|c| c.chars().count() <= CHUNK_CHARS + 80));

        let huge = vec![line; 20].join("\n");
        let capped = chunk_for_chat(&huge);
        assert_eq!(capped.len(), MAX_CHUNKS);
        assert!(capped.last().unwrap().contains("còn tiếp"));
    }

    #[test]
    fn requests_are_asked_in_words_and_answered_in_codex_shapes() {
        let cmd = json!({ "type": "commandExecution", "command": "dir", "reason": "xem thư mục" });
        let kind = request_kind("codex/approval-request", &cmd).unwrap();
        assert_eq!(kind, RequestKind::Command);
        assert!(request_question(kind, &cmd).contains("dir"));
        assert_eq!(request_response(kind, &cmd, Reply::YesAlways), json!({ "decision": "acceptForSession" }));
        assert_eq!(request_response(kind, &cmd, Reply::No), json!({ "decision": "decline" }));

        let perm = json!({ "permissions": { "network": { "enabled": true } } });
        let granted = request_response(RequestKind::Permissions, &perm, Reply::Yes);
        assert_eq!(granted["permissions"], perm["permissions"]);
        assert_eq!(granted["scope"], "turn");
        assert_eq!(request_response(RequestKind::Permissions, &perm, Reply::No)["permissions"], json!({}));

        let ask = json!({ "questions": [{ "id": "q1", "question": "Kỳ nào?", "isSecret": false }] });
        assert_eq!(user_input_response(&ask, " tháng 10 ").unwrap(), json!({ "answers": { "q1": { "answers": ["tháng 10"] } } }));
        assert!(!user_input_is_secret(&ask));
        assert_eq!(request_kind("codex/other", &cmd), None);
    }

    #[test]
    fn in_a_group_the_bot_only_answers_when_addressed() {
        assert_eq!(addressed_to_bot("mai họp lúc 9h nhé", false), None);
        assert_eq!(addressed_to_bot("@Vu Nguyen xem tồn kho", true).as_deref(), Some("@Vu Nguyen xem tồn kho"));
        assert_eq!(addressed_to_bot("Bot, xem tồn kho tháng này", false).as_deref(), Some("xem tồn kho tháng này"));
        assert_eq!(addressed_to_bot("bot xem công nợ", false).as_deref(), Some("xem công nợ"));
        assert_eq!(addressed_to_bot("bot", false), None);
        assert_eq!(addressed_to_bot("robot đang chạy", false), None);
    }
}
