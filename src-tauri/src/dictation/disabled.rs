//! Voice dictation is disabled in this build (feature `voice-dictation` is off).
//! Keeps the same public API as `real.rs`, so commands and the frontend still compile,
//! but every call reports "unavailable". Avoids whisper.cpp (needs LLVM/libclang + CMake).

use serde::Serialize;
use tauri::{AppHandle, State};

const DEFAULT_MODEL_ID: &str = "base";
const DISABLED_MESSAGE: &str = "Voice dictation is not included in this build.";

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DictationModelState {
    Missing,
    Downloading,
    Ready,
    Error,
}

#[derive(Debug, Serialize, Clone)]
pub struct DictationDownloadProgress {
    #[serde(rename = "downloadedBytes")]
    pub downloaded_bytes: u64,
    #[serde(rename = "totalBytes")]
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DictationModelStatus {
    pub state: DictationModelState,
    #[serde(rename = "modelId")]
    pub model_id: String,
    pub progress: Option<DictationDownloadProgress>,
    pub error: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DictationSessionState {
    Idle,
    Listening,
    Processing,
}

#[derive(Default)]
pub struct DictationState;

impl DictationState {
    pub fn new() -> Self {
        Self
    }
}

fn disabled_status(model_id: Option<String>) -> DictationModelStatus {
    DictationModelStatus {
        state: DictationModelState::Error,
        model_id: model_id.unwrap_or_else(|| DEFAULT_MODEL_ID.to_string()),
        progress: None,
        error: Some(DISABLED_MESSAGE.to_string()),
        path: None,
    }
}

pub async fn dictation_model_status(
    _app: AppHandle,
    _state: State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    Ok(disabled_status(model_id))
}

pub async fn dictation_download_model(
    _app: AppHandle,
    _state: State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    Ok(disabled_status(model_id))
}

pub async fn dictation_cancel_download(
    _app: AppHandle,
    _state: State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    Ok(disabled_status(model_id))
}

pub async fn dictation_remove_model(
    _app: AppHandle,
    _state: State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    Ok(disabled_status(model_id))
}

pub async fn dictation_start(
    _preferred_language: Option<String>,
    _model_id: Option<String>,
    _app: AppHandle,
    _state: State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    Err(DISABLED_MESSAGE.to_string())
}

pub async fn dictation_request_permission(_app: AppHandle) -> Result<bool, String> {
    Ok(false)
}

pub async fn dictation_stop(
    _app: AppHandle,
    _state: State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    Err(DISABLED_MESSAGE.to_string())
}

pub async fn dictation_cancel(
    _app: AppHandle,
    _state: State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    Err(DISABLED_MESSAGE.to_string())
}
