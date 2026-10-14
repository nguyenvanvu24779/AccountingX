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
    if !use_system_codex()
        && let Some(path) = bundled_codex()
    {
        return Some(path);
    }
    codex_finder::discover_codex_command()
}

/// Message shown to the user when Codex cannot be started.
pub const MISSING_CODEX_MESSAGE: &str = "Không tìm thấy thành phần AI (Codex) đi kèm AccountingX. \
Vui lòng cài lại ứng dụng hoặc liên hệ bộ phận hỗ trợ.";

const DEFAULT_CONFIG: &str = "# AccountingX defaults. Edit with care.\n\
approval_policy = \"on-request\"\n\
sandbox_mode = \"workspace-write\"\n\
\n\
[features]\n\
code_mode = true\n\
code_mode_host = true\n\
browser_use = true\n\
browser_use_external = true\n\
browser_use_full_cdp_access = true\n";

/// Appended to configs created before these keys existed. `codex-code-mode-host.exe`
/// ships alongside `codex.exe` (see scripts/fetch-codex.ps1), so code mode and the
/// browser_use family it hosts can run.
const CODE_MODE_FEATURES: &str = "\n[features]\ncode_mode = true\ncode_mode_host = true\nbrowser_use = true\nbrowser_use_external = true\nbrowser_use_full_cdp_access = true\n";

/// Creates the private Codex home and a conservative default `config.toml`.
/// An existing config is never overwritten.
/// Skills AccountingX ships, written into `<CODEX_HOME>/skills/<name>/` on
/// every start so an app update also updates them. The `accountingx-` prefix
/// keeps them apart from skills the user installs; those are never touched.
const BUNDLED_SKILLS: &[(&str, &str)] = &[(
    "accountingx-misa-ton-kho",
    include_str!("../skills/accountingx-misa-ton-kho/SKILL.md"),
)];

fn install_bundled_skills(home: &Path) -> std::io::Result<()> {
    for (name, content) in BUNDLED_SKILLS {
        let dir = home.join("skills").join(name);
        let path = dir.join("SKILL.md");
        if fs::read_to_string(&path).ok().as_deref() == Some(*content) {
            continue;
        }
        fs::create_dir_all(&dir)?;
        fs::write(&path, content)?;
    }
    Ok(())
}

pub fn ensure_codex_home(home: &Path) -> std::io::Result<()> {
    fs::create_dir_all(home)?;
    let config = home.join("config.toml");
    if !config.exists() {
        fs::write(config, DEFAULT_CONFIG)?;
    } else {
        // Migrate configs from before code mode / browser_use were turned on,
        // unless the user's config already has its own [features] section.
        let existing = fs::read_to_string(&config)?;
        if !existing.contains("code_mode") && !existing.contains("[features]") {
            fs::write(&config, format!("{existing}{CODE_MODE_FEATURES}"))?;
        }
    }
    install_bundled_skills(home)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_skills_are_installed_and_kept_current() {
        let home = std::env::temp_dir().join(format!("accountingx-skills-{}", std::process::id()));
        install_bundled_skills(&home).unwrap();

        for (name, content) in BUNDLED_SKILLS {
            let path = home.join("skills").join(name).join("SKILL.md");
            assert_eq!(fs::read_to_string(&path).unwrap(), *content);
            assert!(content.starts_with("---
name: ") || content.starts_with("---
name: "));

            // A stale copy from an older app version is replaced.
            fs::write(&path, "old").unwrap();
        }
        install_bundled_skills(&home).unwrap();
        for (name, content) in BUNDLED_SKILLS {
            let path = home.join("skills").join(name).join("SKILL.md");
            assert_eq!(fs::read_to_string(&path).unwrap(), *content);
        }

        fs::remove_dir_all(&home).unwrap();
    }
}
