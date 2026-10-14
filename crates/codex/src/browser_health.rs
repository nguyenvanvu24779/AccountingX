//! Whether this machine is ready for browser-use (MISA through the user's own
//! Chrome), checked from files and the registry only — no agent run and no
//! browser automation, so it is cheap enough to run every time the screen opens.
//!
//! The chain being checked: Chrome → the official ChatGPT extension in some
//! profile → the native messaging host Chrome launches for it → the local
//! `cua_repl` runtime Codex is configured to use. "Extension connected" can
//! only be seen from a live run, so it is not reported here.

use std::path::{Path, PathBuf};

use serde::Serialize;

/// Chrome Web Store id of the official ChatGPT extension.
pub const CHATGPT_EXTENSION_ID: &str = "hehggadaopoacecdllhhajmbjkdcmajg";
const NATIVE_HOST_NAME: &str = "com.openai.codexextension";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeHostStatus {
    /// Chrome has no registration for the host at all.
    NotRegistered,
    /// Registered, but the manifest file it points to is gone or unreadable.
    ManifestMissing,
    /// The manifest doesn't allow the ChatGPT extension to talk to it.
    WrongExtension,
    /// The manifest points at a host program that isn't there.
    HostMissing,
    Ok,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserHealth {
    pub chrome_installed: bool,
    /// Display names of Chrome profiles that have the extension installed.
    pub profiles_with_extension: Vec<String>,
    pub native_host: NativeHostStatus,
    /// `cua_repl` is configured for Codex and its program exists.
    pub browser_runtime: bool,
    /// The ChatGPT / Codex desktop app is open. Browser control then sees two
    /// browser connections and cannot tell which one is the user's Chrome.
    pub desktop_app_running: bool,
    pub ready: bool,
}

pub fn check(codex_home: &Path) -> BrowserHealth {
    let chrome_installed = chrome_executables().iter().any(|p| p.is_file());
    let profiles_with_extension = chrome_user_data_dir()
        .map(|dir| profiles_with_extension(&dir))
        .unwrap_or_default();
    let native_host = native_host_status();
    let browser_runtime = std::fs::read_to_string(codex_home.join("config.toml"))
        .map(|config| browser_runtime_configured(&config))
        .unwrap_or(false);

    BrowserHealth {
        ready: chrome_installed
            && !profiles_with_extension.is_empty()
            && native_host == NativeHostStatus::Ok
            && browser_runtime,
        chrome_installed,
        profiles_with_extension,
        native_host,
        browser_runtime,
        desktop_app_running: desktop_app_running(),
    }
}

/// Executable name of the ChatGPT / Codex desktop app.
const DESKTOP_APP_EXE: &str = "ChatGPT.exe";

#[cfg(windows)]
fn desktop_app_running() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    std::process::Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {DESKTOP_APP_EXE}"), "/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|out| tasklist_lists_process(&String::from_utf8_lossy(&out.stdout), DESKTOP_APP_EXE))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn desktop_app_running() -> bool {
    false
}

/// Whether `tasklist /FO CSV /NH` output names this process.
#[cfg_attr(not(windows), allow(dead_code))]
fn tasklist_lists_process(output: &str, exe: &str) -> bool {
    output.lines().any(|line| {
        line.trim_start_matches('"')
            .split('"')
            .next()
            .is_some_and(|name| name.eq_ignore_ascii_case(exe))
    })
}

fn chrome_executables() -> Vec<PathBuf> {
    ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"]
        .iter()
        .filter_map(std::env::var_os)
        .map(|base| PathBuf::from(base).join("Google").join("Chrome").join("Application").join("chrome.exe"))
        .collect()
}

fn chrome_user_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join("Google").join("Chrome").join("User Data"))
}

/// Profiles (by the name the user sees in Chrome) whose `Extensions` folder
/// holds the ChatGPT extension.
fn profiles_with_extension(user_data: &Path) -> Vec<String> {
    // `Local State` maps profile folders ("Default", "Profile 3") to the
    // names shown in Chrome's profile picker.
    let names: serde_json::Map<String, serde_json::Value> = std::fs::read_to_string(user_data.join("Local State"))
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|state| state.pointer("/profile/info_cache").and_then(|v| v.as_object()).cloned())
        .unwrap_or_default();

    let Ok(entries) = std::fs::read_dir(user_data) else {
        return Vec::new();
    };
    let mut found: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().join("Extensions").join(CHATGPT_EXTENSION_ID).is_dir())
        .map(|entry| {
            let folder = entry.file_name().to_string_lossy().into_owned();
            names
                .get(&folder)
                .and_then(|info| info.get("name"))
                .and_then(|name| name.as_str())
                .map(str::to_string)
                .unwrap_or(folder)
        })
        .collect();
    found.sort();
    found
}

fn native_host_status() -> NativeHostStatus {
    let Some(manifest_path) = native_host_manifest_path() else {
        return NativeHostStatus::NotRegistered;
    };
    let Some(manifest) = std::fs::read_to_string(&manifest_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
    else {
        return NativeHostStatus::ManifestMissing;
    };
    native_host_manifest_status(&manifest, manifest_path.parent())
}

fn native_host_manifest_status(manifest: &serde_json::Value, manifest_dir: Option<&Path>) -> NativeHostStatus {
    let origin = format!("chrome-extension://{CHATGPT_EXTENSION_ID}/");
    let allowed = manifest
        .get("allowed_origins")
        .and_then(|v| v.as_array())
        .is_some_and(|origins| origins.iter().any(|o| o.as_str() == Some(origin.as_str())));
    if !allowed {
        return NativeHostStatus::WrongExtension;
    }
    let Some(host) = manifest.get("path").and_then(|v| v.as_str()).map(PathBuf::from) else {
        return NativeHostStatus::HostMissing;
    };
    // Chrome resolves a relative host path against the manifest's folder.
    let host = match manifest_dir {
        Some(dir) if host.is_relative() => dir.join(host),
        _ => host,
    };
    if host.is_file() { NativeHostStatus::Ok } else { NativeHostStatus::HostMissing }
}

#[cfg(windows)]
fn native_host_manifest_path() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    // Chrome checks the per-user registration before the machine-wide one.
    ["HKCU", "HKLM"].iter().find_map(|hive| {
        let key = format!(r"{hive}\Software\Google\Chrome\NativeMessagingHosts\{NATIVE_HOST_NAME}");
        let output = std::process::Command::new("reg")
            .args(["query", &key, "/ve"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        parse_reg_default_value(&String::from_utf8_lossy(&output.stdout)).map(PathBuf::from)
    })
}

#[cfg(not(windows))]
fn native_host_manifest_path() -> Option<PathBuf> {
    None
}

/// The data of the `(Default)` value from `reg query <key> /ve` output.
#[cfg_attr(not(windows), allow(dead_code))]
fn parse_reg_default_value(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (_, value) = line.split_once("REG_SZ")?;
        let value = value.trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

/// Whether Codex's config has a `cua_repl` MCP server whose program exists.
fn browser_runtime_configured(config: &str) -> bool {
    let Ok(config) = config.parse::<toml::Table>() else {
        return false;
    };
    config
        .get("mcp_servers")
        .and_then(|servers| servers.get("cua_repl"))
        .and_then(|server| server.get("command"))
        .and_then(|command| command.as_str())
        .is_some_and(|command| Path::new(command).is_file())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("accountingx-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reads_the_default_value_from_reg_output() {
        let output = "\r\nHKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.openai.codexextension\r\n    (Default)    REG_SZ    C:\\Users\\a b\\host.json\r\n\r\n";
        assert_eq!(parse_reg_default_value(output).as_deref(), Some("C:\\Users\\a b\\host.json"));
        assert_eq!(parse_reg_default_value("ERROR: not found"), None);
    }

    #[test]
    fn finds_profiles_with_the_extension_by_display_name() {
        let user_data = temp_dir("chrome-profiles");
        std::fs::create_dir_all(user_data.join("Profile 3").join("Extensions").join(CHATGPT_EXTENSION_ID)).unwrap();
        std::fs::create_dir_all(user_data.join("Profile 9").join("Extensions").join(CHATGPT_EXTENSION_ID)).unwrap();
        std::fs::create_dir_all(user_data.join("Default").join("Extensions").join("someotherextension")).unwrap();
        std::fs::write(
            user_data.join("Local State"),
            json!({ "profile": { "info_cache": { "Profile 3": { "name": "Kế toán" } } } }).to_string(),
        )
        .unwrap();

        // A profile missing from Local State falls back to its folder name.
        assert_eq!(profiles_with_extension(&user_data), vec!["Kế toán".to_string(), "Profile 9".to_string()]);
        std::fs::remove_dir_all(&user_data).unwrap();
    }

    #[test]
    fn native_host_manifest_must_allow_the_extension_and_point_at_a_real_host() {
        let dir = temp_dir("native-host");
        std::fs::write(dir.join("host.exe"), "").unwrap();
        let origin = format!("chrome-extension://{CHATGPT_EXTENSION_ID}/");

        let ok = json!({ "allowed_origins": [origin], "path": "host.exe" });
        assert_eq!(native_host_manifest_status(&ok, Some(&dir)), NativeHostStatus::Ok);

        let missing_host = json!({ "allowed_origins": [origin], "path": "gone.exe" });
        assert_eq!(native_host_manifest_status(&missing_host, Some(&dir)), NativeHostStatus::HostMissing);

        let other = json!({ "allowed_origins": ["chrome-extension://someone-else/"], "path": "host.exe" });
        assert_eq!(native_host_manifest_status(&other, Some(&dir)), NativeHostStatus::WrongExtension);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn browser_runtime_needs_cua_repl_with_an_existing_program() {
        let dir = temp_dir("cua-runtime");
        let node = dir.join("node.exe");
        std::fs::write(&node, "").unwrap();
        let config = format!("[mcp_servers.cua_repl]\ncommand = '{}'\n", node.display());
        assert!(browser_runtime_configured(&config));
        assert!(!browser_runtime_configured("[mcp_servers.cua_repl]\ncommand = 'C:/nope/node.exe'\n"));
        assert!(!browser_runtime_configured("approval_policy = \"on-request\"\n"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tasklist_output_is_matched_by_exact_process_name() {
        let running = "\"ChatGPT.exe\",\"4242\",\"Console\",\"1\",\"120,000 K\"\r\n";
        assert!(tasklist_lists_process(running, "ChatGPT.exe"));
        assert!(tasklist_lists_process(&running.to_lowercase(), "ChatGPT.exe"));
        assert!(!tasklist_lists_process("INFO: No tasks are running which match the specified criteria.", "ChatGPT.exe"));
        assert!(!tasklist_lists_process("\"NotChatGPT.exe\",\"1\"", "ChatGPT.exe"));
    }
}
