use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::State;

use crate::analytics::{self, RecapData};
use crate::animation::{self, CompanionColors};
use crate::companion_store::{self, Companion, Settings};

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

pub struct AppState {
    pub sqlite_conn: Arc<Mutex<rusqlite::Connection>>,
    pub db_path: PathBuf,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Return today's activity recap (uses DuckDB analytics path).
#[tauri::command]
pub async fn get_recap_data(state: State<'_, AppState>) -> Result<RecapData, String> {
    let db_path = state.db_path.join("activity.db");
    analytics::get_recap_data(&db_path).map_err(|e| e.to_string())
}

/// Return all configured companions.
#[tauri::command]
pub async fn get_companions(state: State<'_, AppState>) -> Result<Vec<Companion>, String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::get_all(&conn).map_err(|e| e.to_string())
}

/// Add a new companion with default settings.
#[tauri::command]
pub async fn add_companion(state: State<'_, AppState>) -> Result<Companion, String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::add(&conn).map_err(|e| e.to_string())
}

/// Remove a companion by ID.
#[tauri::command]
pub async fn remove_companion(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::remove(&conn, &id).map_err(|e| e.to_string())
}

/// Update mutable fields of an existing companion.
#[tauri::command]
pub async fn update_companion(
    id: String,
    name: Option<String>,
    companion_type: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::update(
        &conn,
        &id,
        name.as_deref(),
        companion_type.as_deref(),
        x,
        y,
    )
    .map_err(|e| e.to_string())
}

/// Return the current application settings.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::get_settings(&conn).map_err(|e| e.to_string())
}

/// Persist a single key/value setting.
#[tauri::command]
pub async fn update_settings(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.sqlite_conn.lock().unwrap();
    companion_store::update_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

/// Return the SVG string for a single animation frame.
///
/// `companion_type` resolves the colour palette.
#[tauri::command]
pub async fn get_animation_frame(
    anim_state: String,
    frame_index: usize,
    companion_type: String,
    _state: State<'_, AppState>,
) -> Result<String, String> {
    let colors = CompanionColors::from_type(&companion_type);
    Ok(animation::render_frame_svg(&anim_state, frame_index, &colors))
}
