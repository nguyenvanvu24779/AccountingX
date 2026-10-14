use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use codexia_shared::zalo::ZaloSidecar;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

/// The Zalo account the bot is logged in as.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZaloAccount {
    pub user_id: String,
    pub display_name: String,
    pub avatar: Option<String>,
}

/// Lazily-started: `None` until the user clicks Connect in Settings.
#[derive(Default)]
pub struct ZaloState {
    pub sidecar: Mutex<Option<Arc<ZaloSidecar>>>,
    /// Path to the QR PNG the sidecar last wrote, once it has one.
    pub qr_path: Mutex<Option<String>>,
    pub connected: AtomicBool,
    /// Set once the sidecar reports who it logged in as.
    pub account: Mutex<Option<ZaloAccount>>,
    pub last_error: Mutex<Option<String>>,
    /// Set while the QR has been scanned and the phone is waiting for approval.
    pub qr_scanned_by: Mutex<Option<String>>,
}

impl ZaloState {
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    /// Stop any sidecar and forget everything about the current login attempt,
    /// including the QR image, which is only valid for a short while.
    pub async fn reset_login(&self) {
        let sidecar = self.sidecar.lock().await.take();
        if let Some(sidecar) = sidecar {
            sidecar.stop().await;
        }
        self.connected.store(false, Ordering::Relaxed);
        if let Some(path) = self.qr_path.lock().await.take() {
            let _ = std::fs::remove_file(path);
        }
        *self.qr_scanned_by.lock().await = None;
        *self.last_error.lock().await = None;
        *self.account.lock().await = None;
    }
}
