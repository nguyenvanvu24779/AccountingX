//! Zalo sidecar: spawns and talks to `bots/zalo/index.js`.
//!
//! Protocol mirrors `crates/codex/src/app_server.rs` — newline-delimited
//! JSON over stdio, requests correlated by `id`, notifications (no `id`)
//! pushed to whoever is listening. See `bots/zalo/index.js` for the wire
//! shape and the caveats around session resume (untested against a real
//! account as of this writing).
//!
//! Packaging note: this spawns a system `node` (or `ACCOUNTINGX_NODE_BIN`)
//! and a script found on disk — there is no bundled Node runtime yet, same
//! open gap `docs/CODEX_BUNDLING.md` already flags for the browser-use path.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

const STDERR_TAIL_LINES: usize = 20;

/// Message for requests still waiting when the sidecar dies: the most telling
/// stderr line (a Node error such as a missing package), if there is one.
fn exit_reason(stderr_tail: &[String]) -> String {
    let cause = stderr_tail
        .iter()
        .rev()
        .find(|line| line.contains("Error") || line.contains("Cannot find"))
        .or_else(|| stderr_tail.last());
    match cause {
        Some(line) => format!("Zalo sidecar process exited: {}", line.trim()),
        None => "Zalo sidecar process exited".to_string(),
    }
}
use tokio::sync::{Mutex, oneshot};

/// A notification line (no `id`): `{"method": "...", "params": {...}}`.
pub type NotificationHandler = Arc<dyn Fn(String, Value) + Send + Sync>;

type PendingRequests = Arc<Mutex<HashMap<i64, oneshot::Sender<Result<Value, String>>>>>;

pub struct ZaloSidecar {
    child: Mutex<Child>,
    stdin: Mutex<tokio::process::ChildStdin>,
    pending: PendingRequests,
    next_id: AtomicI64,
}

/// Locations that may hold `bots/zalo/index.js`, most specific first — the
/// same convention `crates/codex/src/runtime.rs::bundled_candidates` uses.
fn script_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(path) = std::env::var_os("ACCOUNTINGX_ZALO_SCRIPT") {
        out.push(PathBuf::from(path));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("resources").join("bots").join("zalo").join("index.js"));
        }
        for ancestor in exe.ancestors().skip(1).take(4) {
            out.push(ancestor.join("bots").join("zalo").join("index.js"));
        }
    }
    out
}

pub fn resolve_sidecar_script() -> Option<PathBuf> {
    script_candidates().into_iter().find(|p| p.is_file())
}

fn node_command() -> String {
    std::env::var("ACCOUNTINGX_NODE_BIN").unwrap_or_else(|_| "node".to_string())
}

impl ZaloSidecar {
    /// Spawn the sidecar. `session_dir` is where it keeps `session.json` and
    /// the QR PNG — typically `~/.accountingx/zalo/`.
    pub async fn spawn(
        script: &Path,
        session_dir: &Path,
        on_notification: NotificationHandler,
    ) -> Result<Self, String> {
        std::fs::create_dir_all(session_dir)
            .map_err(|e| format!("could not create Zalo session dir: {e}"))?;

        let mut command = Command::new(node_command());
        command
            .arg(script)
            .env("ACCOUNTINGX_ZALO_SESSION_DIR", session_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command
            .spawn()
            .map_err(|e| format!("could not spawn Zalo sidecar ({script:?}): {e}"))?;

        let stdin = child.stdin.take().ok_or("Zalo sidecar has no stdin")?;
        let stdout = child.stdout.take().ok_or("Zalo sidecar has no stdout")?;
        let stderr = child.stderr.take().ok_or("Zalo sidecar has no stderr")?;

        let pending: PendingRequests = Arc::new(Mutex::new(HashMap::new()));
        // The last few stderr lines, so a crash can say why instead of only
        // "process exited" (e.g. a missing npm package).
        let stderr_tail: Arc<std::sync::Mutex<Vec<String>>> = Arc::default();

        let pending_for_reader = Arc::clone(&pending);
        let stderr_tail_for_reader = Arc::clone(&stderr_tail);
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        let Ok(value) = serde_json::from_str::<Value>(&line) else {
                            log::warn!("zalo sidecar: unparsable line: {line}");
                            continue;
                        };
                        if let Some(id) = value.get("id").and_then(Value::as_i64) {
                            let mut pending = pending_for_reader.lock().await;
                            if let Some(tx) = pending.remove(&id) {
                                let result = if let Some(err) = value.get("error") {
                                    Err(err.to_string())
                                } else {
                                    Ok(value.get("result").cloned().unwrap_or(Value::Null))
                                };
                                let _ = tx.send(result);
                            }
                        } else if let Some(method) = value.get("method").and_then(Value::as_str) {
                            let params = value.get("params").cloned().unwrap_or(Value::Null);
                            on_notification(method.to_string(), params);
                        }
                    }
                    Ok(None) => {
                        log::warn!("zalo sidecar: stdout closed (process exited)");
                        break;
                    }
                    Err(e) => {
                        log::warn!("zalo sidecar: stdout read error: {e}");
                        break;
                    }
                }
            }
            // The process is gone — anyone still awaiting a response would
            // otherwise hang forever, since nothing will ever answer them.
            // stderr is drained by its own task; give it a moment to catch up.
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            let reason = exit_reason(&stderr_tail_for_reader.lock().unwrap_or_else(|e| e.into_inner()));
            let mut pending = pending_for_reader.lock().await;
            for (_, tx) in pending.drain() {
                let _ = tx.send(Err(reason.clone()));
            }
        });

        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::warn!("zalo sidecar stderr: {line}");
                let mut tail = stderr_tail.lock().unwrap_or_else(|e| e.into_inner());
                tail.push(line);
                if tail.len() > STDERR_TAIL_LINES {
                    tail.remove(0);
                }
            }
        });

        Ok(Self {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            pending,
            next_id: AtomicI64::new(1),
        })
    }

    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let line = serde_json::to_string(&serde_json::json!({
            "id": id,
            "method": method,
            "params": params,
        }))
        .map_err(|e| format!("could not encode Zalo request: {e}"))?;

        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(format!("{line}\n").as_bytes())
                .await
                .map_err(|e| format!("could not write to Zalo sidecar: {e}"))?;
        }

        rx.await.map_err(|_| "Zalo sidecar closed before responding".to_string())?
    }

    pub async fn start(&self) -> Result<Value, String> {
        self.request("start", Value::Null).await
    }

    pub async fn send_message(
        &self,
        thread_id: &str,
        thread_type: &str,
        text: &str,
    ) -> Result<Value, String> {
        self.request(
            "sendMessage",
            serde_json::json!({ "threadId": thread_id, "threadType": thread_type, "text": text }),
        )
        .await
    }

    pub async fn stop(&self) {
        let _ = self.child.lock().await.kill().await;
    }
}

#[cfg(test)]
mod exit_reason_tests {
    use super::exit_reason;

    #[test]
    fn prefers_the_error_line_over_trailing_noise() {
        let tail = vec![
            "node:internal/modules/package_json_reader:301".to_string(),
            "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zca-js'".to_string(),
            "Node.js v24.17.0".to_string(),
        ];
        assert_eq!(
            exit_reason(&tail),
            "Zalo sidecar process exited: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zca-js'"
        );
    }

    #[test]
    fn falls_back_to_a_plain_message_without_stderr() {
        assert_eq!(exit_reason(&[]), "Zalo sidecar process exited");
    }
}
