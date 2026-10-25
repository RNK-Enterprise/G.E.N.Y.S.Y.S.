//! Tab content backend selection.
//!
//! The logical tab belongs to GENYSYS. This module names the content backend
//! without allowing an unavailable backend to fall through to WebKit.

use serde::{Deserialize, Serialize};

/// Content backend selected for GENYSYS tabs.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TabBackendKind {
    Webkit,
    Camofox,
}

impl TabBackendKind {
    /// Parse a configured backend name, refusing unknown values.
    pub fn from_config_value(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "webkit" | "webkitgtk" => Ok(Self::Webkit),
            "camofox" => Ok(Self::Camofox),
            other => Err(format!("unsupported_tab_backend:{}", other)),
        }
    }

    /// Read the optional backend selector. The current default preserves the
    /// existing WebKit surface; selecting Camofox remains explicit.
    pub fn from_environment() -> Result<Self, String> {
        let value = std::env::var("GENYSYS_TAB_BACKEND").unwrap_or_default();
        Self::from_config_value(&value)
    }

    /// Stable wire/status spelling for diagnostics and future IPC.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Webkit => "webkit",
            Self::Camofox => "camofox",
        }
    }

    /// Whether this backend is implemented by the WebKit child-window module.
    /// Camofox owns a separate live noVNC surface module.
    pub fn has_native_surface(self) -> bool {
        matches!(self, Self::Webkit)
    }

    /// Refusal emitted if a backend reaches the WebKit-only implementation.
    pub fn unavailable_reason(self) -> &'static str {
        match self {
            Self::Webkit => "",
            Self::Camofox => "camofox_surface_owned_by_camofox_backend",
        }
    }
}
