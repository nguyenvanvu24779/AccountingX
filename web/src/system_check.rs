//! "Is this installation healthy?" in one place.
//!
//! Gathers facts about everything the product relies on (the bundled Codex and
//! its login, Node for the Zalo and email helpers, the Zalo helper's packages,
//! the tools and skills the app puts into Codex, Zalo's connection, Chrome and
//! its extension, a company folder, free disk space) and turns them into a list
//! of checks. The UI explains what to do about each one that is not green; the
//! few that the app can mend itself are repaired by `api_system_repair`.
//!
//! Evaluation is a pure function of the gathered facts, so what counts as a
//! problem is tested without a machine in any particular state.

use std::path::{Path, PathBuf};
use std::time::Duration;

use axum::{Json, extract::State as AxumState};
use codexia_codex::browser_health::{self, BrowserHealth};
use serde::Serialize;
use serde_json::Value;

use crate::types::{ErrorResponse, WebServerState};

/// Codex version the product was tested with; a different one still runs but is flagged.
const EXPECTED_CODEX: &str = "0.161.0";
const MIN_FREE_GB_WARN: f64 = 2.0;
const MIN_FREE_GB_FAIL: f64 = 0.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Ok,
    Warn,
    Fail,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    /// Stable id the UI uses to pick its explanation, e.g. `codex.login`.
    pub id: &'static str,
    /// `codex`, `zalo`, `browser` or `machine`.
    pub group: &'static str,
    pub status: Status,
    /// A fact worth showing next to the result (a version, a path, a number).
    pub detail: Option<String>,
    /// The app can put this right itself (see `api_system_repair`).
    pub auto_fixable: bool,
}

/// Everything learned about the machine.
#[derive(Debug, Default)]
pub struct Facts {
    pub codex_binary: Option<PathBuf>,
    pub codex_version: Option<String>,
    pub codex_running: bool,
    /// `None` when Codex could not be asked.
    pub codex_logged_in: Option<bool>,
    pub node_version: Option<String>,
    pub zalo_script_found: bool,
    pub zalo_deps: bool,
    pub zalo_mcp_deps: bool,
    pub zalo_mcp_registered: bool,
    pub skills: Vec<(String, bool)>,
    pub zalo_connected: bool,
    pub browser: Option<BrowserHealth>,
    pub company_count: usize,
    pub disk_free_gb: Option<f64>,
}

fn check(id: &'static str, group: &'static str, status: Status, detail: Option<String>, auto_fixable: bool) -> Check {
    Check { id, group, status, detail, auto_fixable }
}

fn ok_or(ok: bool, otherwise: Status) -> Status {
    if ok { Status::Ok } else { otherwise }
}

pub fn evaluate(facts: &Facts) -> Vec<Check> {
    let mut checks = Vec::new();

    // --- Codex
    checks.push(check(
        "codex.binary",
        "codex",
        ok_or(facts.codex_binary.is_some(), Status::Fail),
        facts.codex_binary.as_ref().map(|p| p.display().to_string()),
        false,
    ));
    let version_matches = facts.codex_version.as_deref().is_some_and(|v| v.contains(EXPECTED_CODEX));
    checks.push(check(
        "codex.version",
        "codex",
        if facts.codex_version.is_none() || version_matches { Status::Ok } else { Status::Warn },
        facts.codex_version.clone(),
        false,
    ));
    checks.push(check("codex.running", "codex", ok_or(facts.codex_running, Status::Fail), None, false));
    checks.push(check(
        "codex.login",
        "codex",
        match facts.codex_logged_in {
            Some(true) => Status::Ok,
            Some(false) => Status::Fail,
            // Could not ask: not a problem of its own, "codex.running" says why.
            None => Status::Warn,
        },
        None,
        false,
    ));

    // --- Zalo and the helpers it needs
    checks.push(check(
        "zalo.node",
        "zalo",
        ok_or(facts.node_version.is_some(), Status::Warn),
        facts.node_version.clone(),
        false,
    ));
    checks.push(check(
        "zalo.packages",
        "zalo",
        ok_or(facts.zalo_script_found && facts.zalo_deps && facts.zalo_mcp_deps, Status::Warn),
        None,
        false,
    ));
    checks.push(check("zalo.tools", "zalo", ok_or(facts.zalo_mcp_registered, Status::Warn), None, true));
    checks.push(check(
        "zalo.connection",
        "zalo",
        ok_or(facts.zalo_connected, Status::Warn),
        None,
        false,
    ));

    // --- Skills the app installs into Codex
    let missing: Vec<&str> = facts.skills.iter().filter(|(_, ok)| !ok).map(|(name, _)| name.as_str()).collect();
    checks.push(check(
        "skills",
        "codex",
        ok_or(missing.is_empty() && !facts.skills.is_empty(), Status::Warn),
        (!missing.is_empty()).then(|| missing.join(", ")),
        true,
    ));

    // --- Browser and MISA
    match &facts.browser {
        Some(browser) => {
            checks.push(check("browser.chrome", "browser", ok_or(browser.chrome_installed, Status::Warn), None, false));
            checks.push(check(
                "browser.extension",
                "browser",
                ok_or(!browser.profiles_with_extension.is_empty(), Status::Warn),
                (!browser.profiles_with_extension.is_empty()).then(|| browser.profiles_with_extension.join(", ")),
                false,
            ));
            checks.push(check(
                "browser.bridge",
                "browser",
                ok_or(browser.native_host == browser_health::NativeHostStatus::Ok, Status::Warn),
                None,
                false,
            ));
            checks.push(check("browser.runtime", "browser", ok_or(browser.browser_runtime, Status::Warn), None, false));
            checks.push(check(
                "browser.desktopApp",
                "browser",
                ok_or(!browser.desktop_app_running, Status::Warn),
                None,
                false,
            ));
        }
        None => checks.push(check("browser.chrome", "browser", Status::Warn, None, false)),
    }

    // --- The machine and the work itself
    checks.push(check("company", "machine", ok_or(facts.company_count > 0, Status::Warn), Some(facts.company_count.to_string()), false));
    if let Some(free) = facts.disk_free_gb {
        let status = if free < MIN_FREE_GB_FAIL {
            Status::Fail
        } else if free < MIN_FREE_GB_WARN {
            Status::Warn
        } else {
            Status::Ok
        };
        checks.push(check("disk", "machine", status, Some(format!("{free:.1}")), false));
    }

    checks
}

/// The worst status in the list.
pub fn overall(checks: &[Check]) -> Status {
    if checks.iter().any(|c| c.status == Status::Fail) {
        Status::Fail
    } else if checks.iter().any(|c| c.status == Status::Warn) {
        Status::Warn
    } else {
        Status::Ok
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SystemCheckResult {
    overall: Status,
    checks: Vec<Check>,
}

fn node_version() -> Option<String> {
    let mut command = std::process::Command::new(codexia_shared::zalo::node_command());
    command.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let out = command.output().ok().filter(|o| o.status.success())?;
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string()).filter(|v| !v.is_empty())
}

/// Free space, in GB, on the drive that holds `path`.
#[cfg(windows)]
fn disk_free_gb(path: &Path) -> Option<f64> {
    use std::os::windows::process::CommandExt;
    let drive = path.to_string_lossy().chars().next().filter(char::is_ascii_alphabetic)?;
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &format!("(Get-PSDrive -Name {drive}).Free")])
        .creation_flags(0x0800_0000)
        .output()
        .ok()?;
    let bytes: f64 = String::from_utf8_lossy(&out.stdout).trim().parse().ok()?;
    Some(bytes / 1_073_741_824.0)
}

#[cfg(not(windows))]
fn disk_free_gb(_path: &Path) -> Option<f64> {
    None
}

fn companies_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".accountingx").join("companies"))
}

async fn gather(state: &WebServerState) -> Facts {
    let home = codexia_codex::runtime::effective_codex_home();
    let sidecar_dir = codexia_shared::zalo::resolve_sidecar_script().and_then(|s| s.parent().map(Path::to_path_buf));
    let mcp_script = codexia_shared::zalo::resolve_mcp_script();

    let blocking_home = home.clone();
    let blocking = tokio::task::spawn_blocking(move || {
        (
            node_version(),
            disk_free_gb(&blocking_home),
            browser_health::check(&blocking_home),
            codexia_codex::runtime::bundled_skills_status(&blocking_home),
            codexia_codex::runtime::zalo_mcp_registered(&blocking_home),
        )
    })
    .await
    .ok();

    let codex_logged_in = match state.codex_state.as_ref() {
        Some(codex) => {
            let asked = tokio::time::timeout(
                Duration::from_secs(5),
                codex.codex.send_request("account/read", serde_json::json!({ "refreshToken": false })),
            )
            .await;
            match asked {
                Ok(Ok(response)) => Some(response.get("account").is_some_and(|a| !a.is_null())),
                _ => None,
            }
        }
        None => None,
    };

    let mut facts = Facts {
        codex_binary: codexia_codex::runtime::bundled_codex(),
        codex_version: codexia_codex::runtime::bundled_version(),
        codex_running: state.codex_state.is_some(),
        codex_logged_in,
        zalo_script_found: sidecar_dir.is_some(),
        zalo_deps: sidecar_dir.as_ref().is_some_and(|d| d.join("node_modules").join("zca-js").is_dir()),
        zalo_mcp_deps: mcp_script
            .as_ref()
            .and_then(|s| s.parent())
            .is_some_and(|d| d.join("node_modules").join("@modelcontextprotocol").is_dir()),
        zalo_connected: state.zalo_state.is_connected(),
        company_count: companies_dir()
            .map(|d| crate::zalo_text::list_companies(&d).len())
            .unwrap_or(0),
        ..Facts::default()
    };
    if let Some((node, disk, browser, skills, mcp)) = blocking {
        facts.node_version = node;
        facts.disk_free_gb = disk;
        facts.browser = Some(browser);
        facts.skills = skills.into_iter().map(|(n, ok)| (n.to_string(), ok)).collect();
        facts.zalo_mcp_registered = mcp;
    }
    facts
}

pub(crate) async fn api_system_check(
    AxumState(state): AxumState<WebServerState>,
) -> Result<Json<SystemCheckResult>, ErrorResponse> {
    let checks = evaluate(&gather(&state).await);
    Ok(Json(SystemCheckResult { overall: overall(&checks), checks }))
}

/// Put back what the app maintains in Codex's home (skills, Zalo tools, defaults).
pub(crate) async fn api_system_repair() -> Result<Json<Value>, ErrorResponse> {
    let home = codexia_codex::runtime::effective_codex_home();
    tokio::task::spawn_blocking(move || codexia_codex::runtime::repair_codex_home(&home))
        .await
        .map_err(|e| ErrorResponse { error: format!("Repair failed: {e}") })?
        .map_err(|e| ErrorResponse { error: format!("Repair failed: {e}") })?;
    Ok(Json(serde_json::json!({ "repaired": true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn healthy() -> Facts {
        Facts {
            codex_binary: Some(PathBuf::from("C:/app/codex.exe")),
            codex_version: Some("rust-v0.161.0".into()),
            codex_running: true,
            codex_logged_in: Some(true),
            node_version: Some("v24.0.0".into()),
            zalo_script_found: true,
            zalo_deps: true,
            zalo_mcp_deps: true,
            zalo_mcp_registered: true,
            skills: vec![("accountingx-misa-phien".into(), true), ("accountingx-misa-ton-kho".into(), true)],
            zalo_connected: true,
            browser: Some(BrowserHealth {
                chrome_installed: true,
                profiles_with_extension: vec!["Nguyen".into()],
                native_host: browser_health::NativeHostStatus::Ok,
                browser_runtime: true,
                desktop_app_running: false,
                ready: true,
            }),
            company_count: 1,
            disk_free_gb: Some(12.0),
        }
    }

    fn status_of(checks: &[Check], id: &str) -> Status {
        checks.iter().find(|c| c.id == id).unwrap_or_else(|| panic!("no check {id}")).status
    }

    #[test]
    fn a_healthy_machine_is_all_green() {
        let checks = evaluate(&healthy());
        assert_eq!(overall(&checks), Status::Ok, "{checks:?}");
    }

    #[test]
    fn a_missing_codex_or_login_is_a_failure() {
        let mut facts = healthy();
        facts.codex_binary = None;
        facts.codex_running = false;
        facts.codex_logged_in = None;
        let checks = evaluate(&facts);
        assert_eq!(status_of(&checks, "codex.binary"), Status::Fail);
        assert_eq!(status_of(&checks, "codex.running"), Status::Fail);
        assert_eq!(overall(&checks), Status::Fail);

        let mut facts = healthy();
        facts.codex_logged_in = Some(false);
        assert_eq!(status_of(&evaluate(&facts), "codex.login"), Status::Fail);
    }

    #[test]
    fn a_different_codex_version_is_flagged_but_does_not_block() {
        let mut facts = healthy();
        facts.codex_version = Some("rust-v0.162.1".into());
        let checks = evaluate(&facts);
        assert_eq!(status_of(&checks, "codex.version"), Status::Warn);
        assert_eq!(overall(&checks), Status::Warn);
    }

    #[test]
    fn what_the_app_can_mend_is_marked_fixable() {
        let mut facts = healthy();
        facts.zalo_mcp_registered = false;
        facts.skills[1].1 = false;
        let checks = evaluate(&facts);
        for id in ["zalo.tools", "skills"] {
            let c = checks.iter().find(|c| c.id == id).unwrap();
            assert_eq!(c.status, Status::Warn);
            assert!(c.auto_fixable, "{id}");
        }
        assert_eq!(checks.iter().find(|c| c.id == "skills").unwrap().detail.as_deref(), Some("accountingx-misa-ton-kho"));
        // Missing packages cannot be mended by the app.
        facts.zalo_deps = false;
        assert!(!evaluate(&facts).iter().find(|c| c.id == "zalo.packages").unwrap().auto_fixable);
    }

    #[test]
    fn low_disk_space_warns_and_almost_none_fails() {
        let mut facts = healthy();
        facts.disk_free_gb = Some(1.2);
        assert_eq!(status_of(&evaluate(&facts), "disk"), Status::Warn);
        facts.disk_free_gb = Some(0.04);
        assert_eq!(status_of(&evaluate(&facts), "disk"), Status::Fail);
        facts.disk_free_gb = None;
        assert!(evaluate(&facts).iter().all(|c| c.id != "disk"));
    }

    #[test]
    fn browser_problems_and_a_missing_company_are_warnings() {
        let mut facts = healthy();
        facts.company_count = 0;
        facts.browser.as_mut().unwrap().desktop_app_running = true;
        facts.browser.as_mut().unwrap().profiles_with_extension.clear();
        let checks = evaluate(&facts);
        assert_eq!(status_of(&checks, "company"), Status::Warn);
        assert_eq!(status_of(&checks, "browser.desktopApp"), Status::Warn);
        assert_eq!(status_of(&checks, "browser.extension"), Status::Warn);
        assert_eq!(overall(&checks), Status::Warn);
    }
}
