//! Cloning a repository by running the `git` program, for installing skills
//! from GitHub. This is all the product needs from git, so it is not a
//! library dependency.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Clone `url` into `path` (shallow). A path that already holds a clone is
/// returned as is; one that exists and is not empty is refused.
pub fn clone(url: &str, path: &Path) -> anyhow::Result<PathBuf> {
    if path.exists() {
        if path.join(".git").exists() {
            return Ok(path.to_path_buf());
        }
        if std::fs::read_dir(path)?.next().is_some() {
            anyhow::bail!(
                "target exists and is not an empty directory/git repository: {}",
                path.display()
            );
        }
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut command = Command::new("git");
    command.args(["clone", "--depth", "1", "--quiet", url]).arg(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let output = command
        .output()
        .map_err(|e| anyhow::anyhow!("could not run git (is Git installed?): {e}"))?;
    if !output.status.success() {
        anyhow::bail!("git clone failed: {}", String::from_utf8_lossy(&output.stderr).trim());
    }
    if !path.join(".git").exists() {
        anyhow::bail!("git clone finished but {} is not a repository", path.display());
    }
    Ok(path.to_path_buf())
}
