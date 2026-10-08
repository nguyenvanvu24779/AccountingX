//! Where AccountingX finds Codex and where Codex keeps its state.
//!
//! The product ships its own, pinned Codex binary and uses a private
//! `CODEX_HOME`, so it never reads or changes a developer's own `~/.codex`.
//! Set `ACCOUNTINGX_USE_SYSTEM_CODEX=1` to fall back to the system install
//! and `~/.codex` (development only).

use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
const CODEX_FILE: &str = "codex.exe";
#[cfg(not(target_os = "windows"))]
const CODEX_FILE: &str = "codex";

fn use_system_codex() -> bool {
    std::env::var_os("ACCOUNTINGX_USE_SYSTEM_CODEX").is_some_and(|v| v != "0" && !v.is_empty())
}

/// Private Codex state directory: `~/.accountingx/codex`.
pub fn private_codex_home() -> PathBuf {
    dirs::home_dir()
        .map(|home| home.join(".accountingx").join("codex"))
        .unwrap_or_else(|| PathBuf::from(".accountingx/codex"))
}

/// Directory Codex runs with as `CODEX_HOME`.
pub fn effective_codex_home() -> PathBuf {
    if let Some(path) = std::env::var_os("CODEX_HOME") {
        return PathBuf::from(path);
    }
    if use_system_codex() {
        return dirs::home_dir()
            .map(|home| home.join(".codex"))
            .unwrap_or_else(|| PathBuf::from(".codex"));
    }
    private_codex_home()
}

/// Locations that may hold the bundled binary, most specific first.
fn bundled_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(path) = std::env::var_os("ACCOUNTINGX_CODEX_BIN") {
        out.push(PathBuf::from(path));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("resources").join("codex").join(CODEX_FILE));
            out.push(dir.join("codex").join(CODEX_FILE));
            out.push(dir.join(CODEX_FILE));
        }
        // Running from `target/{debug,release}` during development.
        for ancestor in exe.ancestors().skip(1).take(4) {
            out.push(
                ancestor
                    .join("src-tauri")
                    .join("resources")
                    .join("codex")
                    .join(CODEX_FILE),
            );
        }
    }
    out
}

pub fn bundled_codex() -> Option<PathBuf> {
    bundled_candidates().into_iter().find(|p| p.is_file())
}

/// The Codex executable to launch, or `None` when it cannot be found.
pub fn resolve_codex_command() -> Option<PathBuf> {
    if !use_system_codex() {
        if let Some(path) = bundled_codex() {
            return Some(path);
        }
    }
    codex_finder::discover_codex_command().map(PathBuf::from)
}

/// Message shown to the user when Codex cannot be started.
pub const MISSING_CODEX_MESSAGE: &str = "Không tìm thấy thành phần AI (Codex) đi kèm AccountingX. \
Vui lòng cài lại ứng dụng hoặc liên hệ bộ phận hỗ trợ.";

const DEFAULT_CONFIG: &str = "# AccountingX defaults. Edit with care.\n\
approval_policy = \"on-request\"\n\
sandbox_mode = \"workspace-write\"\n\
\n\
[features]\n\
code_mode = false\n\
code_mode_host = false\n";

/// Appended to configs created before these keys existed.
const CODE_MODE_OFF: &str = "\n[features]\ncode_mode = false\ncode_mode_host = false\n";

/// Creates the private Codex home and a conservative default `config.toml`.
/// An existing config is never overwritten.
pub fn ensure_codex_home(home: &Path) -> std::io::Result<()> {
    fs::create_dir_all(home)?;
    let config = home.join("config.toml");
    if !config.exists() {
        fs::write(config, DEFAULT_CONFIG)?;
    } else {
        // Code mode needs a helper executable AccountingX does not ship; turn it
        // off unless the user's config already mentions it.
        let existing = fs::read_to_string(&config)?;
        if !existing.contains("code_mode") && !existing.contains("[features]") {
            fs::write(&config, format!("{existing}{CODE_MODE_OFF}"))?;
        }
    }
    Ok(())
}
