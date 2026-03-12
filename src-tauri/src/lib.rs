use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use log::{error, info, warn};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tokio::time;

pub mod activity_logger;
pub mod activity_monitor;
pub mod analytics;
pub mod animation;
pub mod commands;
pub mod companion_store;
pub mod ipc_bridge;

use commands::AppState;

// ---------------------------------------------------------------------------
// Application entry-point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Shared application state
        .manage(build_app_state())
        // Command handlers
        .invoke_handler(tauri::generate_handler![
            commands::get_recap_data,
            commands::get_companions,
            commands::add_companion,
            commands::remove_companion,
            commands::update_companion,
            commands::get_settings,
            commands::update_settings,
            commands::get_animation_frame,
        ])
        // Setup hook: DB init, background loops, tray
        .setup(|app| {
            let handle = app.handle().clone();

            // ---------------------------------------------------------------
            // Database initialisation
            // ---------------------------------------------------------------
            let db_path = data_dir(&handle);
            let sqlite_path = db_path.join("activity.db");
            let companion_path = db_path.join("companions.db");

            {
                let state: tauri::State<AppState> = handle.state();

                // Open the real on-disk connection and replace the temporary
                // in-memory placeholder created before the AppHandle existed.
                let real_conn = rusqlite::Connection::open(&companion_path).unwrap_or_else(|e| {
                    panic!("open companion DB at {}: {e}", companion_path.display())
                });
                real_conn
                    .execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
                    .expect("companion DB WAL mode");

                if let Err(e) = companion_store::init_db(&real_conn) {
                    error!("Failed to init companion_store DB: {e}");
                }

                *state.sqlite_conn.lock().unwrap() = real_conn;
                *state.db_path.lock().unwrap() = db_path.clone();

                if let Err(e) = activity_logger::init_db(&sqlite_path) {
                    error!("Failed to init activity_logger DB: {e}");
                }
            }

            // ---------------------------------------------------------------
            // Activity-monitor background loop (every 2 s)
            // ---------------------------------------------------------------
            {
                let handle2 = handle.clone();
                let sqlite_path2 = sqlite_path.clone();
                tauri::async_runtime::spawn(async move {
                    activity_monitor_loop(handle2, sqlite_path2).await;
                });
            }

            // ---------------------------------------------------------------
            // IPC bridge (Unix socket / Windows named pipe)
            // ---------------------------------------------------------------
            {
                let handle3 = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = ipc_bridge::start_ipc_server(handle3).await {
                        error!("IPC bridge error: {e}");
                    }
                });
            }

            // ---------------------------------------------------------------
            // System tray
            // ---------------------------------------------------------------
            build_tray(&handle)?;

            info!("littleGuy setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_app_state() -> AppState {
    // Temporary in-memory placeholder; replaced with the real on-disk
    // connection inside the setup hook once we have the AppHandle.
    let conn =
        rusqlite::Connection::open_in_memory().expect("failed to open in-memory SQLite connection");
    AppState {
        sqlite_conn: Arc::new(Mutex::new(conn)),
        db_path: Arc::new(Mutex::new(PathBuf::new())),
    }
}

fn data_dir(handle: &AppHandle) -> PathBuf {
    handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

// ---------------------------------------------------------------------------
// Activity monitor loop
// ---------------------------------------------------------------------------

async fn activity_monitor_loop(handle: AppHandle, sqlite_path: PathBuf) {
    let mut interval = time::interval(Duration::from_secs(2));
    let mut last_state = String::new();
    let mut last_tick = Instant::now();

    // Separate SQLite connection for the background loop so we don't hold
    // the shared mutex across await points.
    let log_conn = match rusqlite::Connection::open(&sqlite_path) {
        Ok(c) => c,
        Err(e) => {
            error!("activity_monitor_loop: cannot open DB: {e}");
            return;
        }
    };
    if let Err(e) = activity_logger::init_db(&sqlite_path) {
        error!("activity_monitor_loop: init_db failed: {e}");
    }

    loop {
        interval.tick().await;
        let elapsed_ms = last_tick.elapsed().as_millis() as u64;
        last_tick = Instant::now();

        let window_info = activity_monitor::get_active_window().await;
        let idle_secs = activity_monitor::get_idle_seconds().await;

        let state_str = activity_monitor::classify_activity(
            &window_info.process_name,
            &window_info.window_title,
            idle_secs,
        );

        // Log to SQLite
        if let Err(e) = activity_logger::record(
            &log_conn,
            &window_info.process_name,
            &window_info.window_title,
            state_str,
            elapsed_ms,
        ) {
            warn!("activity_logger::record error: {e}");
        }

        // Emit state-change event only when state changes
        if state_str != last_state {
            last_state = state_str.to_string();
            let payload = serde_json::json!({
                "state": state_str,
                "process": window_info.process_name,
                "title": window_info.window_title,
            });
            handle.emit("state-change", payload).ok();

            // Broadcast over IPC bridge too
            let msg = ipc_bridge::IpcMessage {
                msg_type: "state-change".to_string(),
                payload: serde_json::json!({
                    "state": state_str,
                }),
            };
            tauri::async_runtime::spawn(async move {
                ipc_bridge::broadcast(&msg).await.ok();
            });
        }
    }
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------

fn build_tray(handle: &AppHandle) -> Result<()> {
    let show_hide = MenuItem::with_id(handle, "show_hide", "Show / Hide", true, None::<&str>)?;
    let walking = MenuItem::with_id(handle, "walking", "Walking Mode", true, None::<&str>)?;
    let recap = MenuItem::with_id(handle, "recap", "Daily Recap", true, None::<&str>)?;
    let minigame = MenuItem::with_id(handle, "minigame", "Whack-a-Guy", true, None::<&str>)?;
    let add_companion =
        MenuItem::with_id(handle, "add_companion", "Add Companion", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(handle)?;
    let quit = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        handle,
        &[
            &show_hide,
            &walking,
            &recap,
            &minigame,
            &add_companion,
            &sep,
            &quit,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_hide" => toggle_overlay(app),
            "walking" => toggle_walking(app),
            "recap" => open_window(app, "recap"),
            "minigame" => open_window(app, "minigame"),
            "add_companion" => add_companion_cmd(app),
            "quit" => {
                info!("Quit requested from tray");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_overlay(app);
            }
        })
        .build(handle)?;

    Ok(())
}

fn toggle_overlay(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        if win.is_visible().unwrap_or(false) {
            win.hide().ok();
        } else {
            win.show().ok();
            win.set_focus().ok();
        }
    }
}

fn toggle_walking(app: &AppHandle) {
    let msg = ipc_bridge::IpcMessage {
        msg_type: "walking-update".to_string(),
        payload: serde_json::json!({ "toggle": true }),
    };
    tauri::async_runtime::spawn(async move {
        ipc_bridge::broadcast(&msg).await.ok();
    });
    app.emit("walking-toggle", ()).ok();
}

fn open_window(app: &AppHandle, label: &str) {
    if let Some(win) = app.get_webview_window(label) {
        win.show().ok();
        win.set_focus().ok();
    }
}

fn add_companion_cmd(app: &AppHandle) {
    app.emit("add-companion-requested", ()).ok();
}
