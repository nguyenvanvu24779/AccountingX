//! How much the AI may do without asking.
//!
//! Codex asks before it runs a command, changes a file or uses a tool. In
//! `Auto` mode the app answers the ordinary ones itself, so nobody has to press
//! "Allow" over and over. That includes the extra access Codex asks for
//! (network, files outside the company folder), granted for the session.
//! What stays a question for a person, always:
//!
//! - anything that needs typed input (forms, "which period?"),
//! - links to open in a browser.
//!
//! This is separate from the approval tickets that guard sending email and
//! changing MISA: those are enforced by the tools themselves and are not
//! affected by this setting.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionMode {
    /// Ask a person for every request (the default).
    #[default]
    Ask,
    /// Answer ordinary requests automatically.
    Auto,
}

fn settings_file() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".accountingx").join("permissions.json"))
}

#[derive(Serialize, Deserialize, Default)]
struct Stored {
    #[serde(default)]
    mode: PermissionMode,
}

/// The current mode. Anything unreadable means `Ask`: when in doubt, ask.
pub fn mode() -> PermissionMode {
    settings_file()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<Stored>(&raw).ok())
        .map(|stored| stored.mode)
        .unwrap_or_default()
}

pub fn set_mode(mode: PermissionMode) -> Result<(), String> {
    let path = settings_file().ok_or("Cannot find the home directory")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    let raw = serde_json::to_string_pretty(&Stored { mode }).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| format!("Could not save the setting: {e}"))
}

fn is_message_only(schema: Option<&Value>) -> bool {
    match schema {
        None | Some(Value::Null) => true,
        Some(schema) => {
            schema.get("type").and_then(Value::as_str) == Some("object")
                && schema.get("properties").and_then(Value::as_object).is_none_or(|p| p.is_empty())
        }
    }
}

fn supports_session_memory(meta: Option<&Value>) -> bool {
    match meta.and_then(|m| m.get("persist")) {
        Some(Value::String(s)) => s == "session",
        Some(Value::Array(items)) => items.iter().any(|i| i.as_str() == Some("session")),
        _ => false,
    }
}

/// The answer to send for a request Codex made, when `Auto` mode answers it
/// itself; `None` leaves it to a person.
pub fn auto_response(method: &str, params: &Value) -> Option<Value> {
    match method {
        "item/commandExecution/requestApproval" | "item/fileChange/requestApproval" => {
            Some(json!({ "decision": "acceptForSession" }))
        }
        // Extra network or file access: grant exactly what was asked, for the session.
        "item/permissions/requestApproval" => {
            let asked = params.get("permissions")?;
            let mut granted = serde_json::Map::new();
            for key in ["network", "fileSystem"] {
                if let Some(value) = asked.get(key).filter(|v| !v.is_null()) {
                    granted.insert(key.to_string(), value.clone());
                }
            }
            Some(json!({ "permissions": granted, "scope": "session" }))
        }
        // A decision-only prompt, such as "may this tool run?" or "may the
        // browser open this site?". A prompt with fields, or a link, needs a person.
        "mcpServer/elicitation/request" => {
            let decision_only = params.get("mode").and_then(Value::as_str) == Some("form")
                && is_message_only(params.get("requestedSchema"));
            if !decision_only {
                return None;
            }
            let meta = if supports_session_memory(params.get("_meta")) {
                json!({ "persist": "session" })
            } else {
                Value::Null
            };
            Some(json!({ "action": "accept", "content": null, "_meta": meta }))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commands_and_file_changes_are_accepted_for_the_session() {
        for method in ["item/commandExecution/requestApproval", "item/fileChange/requestApproval"] {
            assert_eq!(auto_response(method, &json!({})), Some(json!({ "decision": "acceptForSession" })));
        }
    }

    #[test]
    fn decision_only_prompts_are_accepted_and_remembered_when_the_tool_allows() {
        let plain = json!({ "mode": "form", "message": "Allow?", "requestedSchema": { "type": "object", "properties": {} } });
        let answer = auto_response("mcpServer/elicitation/request", &plain).unwrap();
        assert_eq!(answer["action"], "accept");
        assert!(answer["_meta"].is_null());

        let remembers = json!({ "mode": "form", "requestedSchema": null, "_meta": { "persist": ["session", "always"] } });
        let answer = auto_response("mcpServer/elicitation/request", &remembers).unwrap();
        assert_eq!(answer["_meta"], json!({ "persist": "session" }));
    }

    #[test]
    fn anything_that_needs_a_person_is_left_to_them() {
        let form = json!({ "mode": "form", "requestedSchema": { "type": "object", "properties": { "period": { "type": "string" } } } });
        assert_eq!(auto_response("mcpServer/elicitation/request", &form), None);
        let link = json!({ "mode": "url", "url": "https://example.com", "message": "Sign in" });
        assert_eq!(auto_response("mcpServer/elicitation/request", &link), None);
        assert_eq!(auto_response("item/permissions/requestApproval", &json!({})), None);
        assert_eq!(auto_response("item/tool/requestUserInput", &json!({})), None);
    }

    #[test]
    fn extra_access_is_granted_as_asked_for_the_session() {
        let params = json!({ "permissions": { "network": { "enabled": true }, "fileSystem": null } });
        assert_eq!(
            auto_response("item/permissions/requestApproval", &params),
            Some(json!({ "permissions": { "network": { "enabled": true } }, "scope": "session" }))
        );
    }

    #[test]
    fn the_stored_mode_round_trips_and_defaults_to_asking() {
        let raw = serde_json::to_string(&Stored { mode: PermissionMode::Auto }).unwrap();
        assert_eq!(raw, r#"{"mode":"auto"}"#);
        assert_eq!(serde_json::from_str::<Stored>("{}").unwrap().mode, PermissionMode::Ask);
        assert_eq!(serde_json::from_str::<Stored>(r#"{"mode":"ask"}"#).unwrap().mode, PermissionMode::Ask);
    }
}
