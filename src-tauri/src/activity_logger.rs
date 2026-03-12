use std::path::Path;

use anyhow::{Context, Result};
use chrono::Local;
use rusqlite::{params, Connection};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CREATE_TABLE: &str = "
CREATE TABLE IF NOT EXISTS activity_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    process_name TEXT    NOT NULL,
    window_title TEXT    NOT NULL DEFAULT '',
    state        TEXT    NOT NULL,
    total_ms     INTEGER NOT NULL DEFAULT 0,
    first_seen   INTEGER NOT NULL,
    last_seen    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_date ON activity_sessions(date);
CREATE INDEX IF NOT EXISTS idx_date_proc ON activity_sessions(date, process_name, state);
";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/// Create the activity_sessions table (idempotent) and enable WAL mode.
pub fn init_db(db_path: &Path) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("create data dir {}", parent.display()))?;
    }

    let conn = Connection::open(db_path)
        .with_context(|| format!("open activity DB at {}", db_path.display()))?;

    // WAL mode for concurrent reads without blocking writes
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .context("set WAL mode")?;

    conn.execute_batch(CREATE_TABLE)
        .context("create activity_sessions table")?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/// Upsert today's activity entry for (process_name, state).
///
/// If a row already exists for today with the same process_name and state,
/// `total_ms` is incremented and `last_seen` is updated.  Otherwise a new
/// row is inserted.
pub fn record(
    conn: &Connection,
    process_name: &str,
    window_title: &str,
    state: &str,
    elapsed_ms: u64,
) -> Result<()> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let now_unix = chrono::Utc::now().timestamp();

    // Try to update an existing row for today / process / state
    let rows_changed = conn
        .execute(
            "UPDATE activity_sessions
                SET total_ms   = total_ms + ?1,
                    last_seen  = ?2,
                    window_title = ?3
              WHERE date         = ?4
                AND process_name = ?5
                AND state        = ?6",
            params![
                elapsed_ms as i64,
                now_unix,
                window_title,
                today,
                process_name,
                state,
            ],
        )
        .context("update activity_sessions")?;

    if rows_changed == 0 {
        // Insert a fresh row
        conn.execute(
            "INSERT INTO activity_sessions
                (date, process_name, window_title, state, total_ms, first_seen, last_seen)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                today,
                process_name,
                window_title,
                state,
                elapsed_ms as i64,
                now_unix,
                now_unix,
            ],
        )
        .context("insert activity_sessions")?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Flush / shutdown
// ---------------------------------------------------------------------------

/// Ensure all WAL frames are checkpointed and the connection is cleanly closed.
pub fn flush(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .context("WAL checkpoint on flush")?;
    Ok(())
}
