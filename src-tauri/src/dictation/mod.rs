// Voice dictation (whisper.cpp) is optional: building it needs LLVM/libclang + CMake.
// AccountingX builds without it by default (uses `disabled.rs`);
// enable the real implementation with `--features voice-dictation`.
#[cfg_attr(feature = "voice-dictation", path = "real.rs")]
#[cfg_attr(not(feature = "voice-dictation"), path = "disabled.rs")]
mod imp;

pub use imp::*;
