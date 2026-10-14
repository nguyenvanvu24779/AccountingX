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
}

impl ZaloState {
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }
}
