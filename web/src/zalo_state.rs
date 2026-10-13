use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use codexia_shared::zalo::ZaloSidecar;
use tokio::sync::Mutex;

/// Lazily-started: `None` until the user clicks Connect in Settings.
#[derive(Default)]
pub struct ZaloState {
    pub sidecar: Mutex<Option<Arc<ZaloSidecar>>>,
    /// Path to the QR PNG the sidecar last wrote, once it has one.
    pub qr_path: Mutex<Option<String>>,
    pub connected: AtomicBool,
    pub last_error: Mutex<Option<String>>,
}

impl ZaloState {
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }
}
