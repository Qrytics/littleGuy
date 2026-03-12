use std::collections::HashMap;
use std::path::Path;

use anyhow::{Context, Result};
use chrono::Local;
use duckdb::Connection as DuckConn;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecapEntry {
    pub process_name: String,
    pub window_title: String,
    pub state: String,
    pub total_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecapData {
    pub date: String,
    pub total_ms: i64,
    pub by_app: Vec<RecapEntry>,
    pub by_category: HashMap<String, i64>,
}

// ---------------------------------------------------------------------------
// DuckDB analytics query
// ---------------------------------------------------------------------------

/// Open an in-memory DuckDB connection, attach the SQLite WAL file via the
/// `sqlite_scan` table function, and return today's activity recap.
pub fn get_recap_data(sqlite_path: &Path) -> Result<RecapData> {
    let today = Local::now().format("%Y-%m-%d").to_string();

    let conn = DuckConn::open_in_memory().context("open DuckDB in-memory connection")?;

    // Install & load the sqlite extension (bundled build includes it)
    conn.execute_batch("INSTALL sqlite; LOAD sqlite;")
        .context("load DuckDB sqlite extension")?;

    let sqlite_path_str = sqlite_path
        .to_str()
        .context("sqlite path is not valid UTF-8")?;

    // Query using sqlite_scan — reads directly from the SQLite WAL file
    let query = format!(
        "SELECT process_name, window_title, state, SUM(total_ms) AS total_ms
           FROM sqlite_scan('{sqlite_path_str}', 'activity_sessions')
          WHERE date = '{today}'
          GROUP BY process_name, window_title, state
          ORDER BY total_ms DESC"
    );

    let mut stmt = conn.prepare(&query).context("prepare DuckDB query")?;
    let rows = stmt
        .query_map([], |row| {
            Ok(RecapEntry {
                process_name: row.get(0)?,
                window_title: row.get(1)?,
                state: row.get(2)?,
                total_ms: row.get(3)?,
            })
        })
        .context("execute DuckDB query")?;

    let mut by_app: Vec<RecapEntry> = Vec::new();
    for row in rows {
        by_app.push(row.context("fetch DuckDB row")?);
    }

    // Aggregate by category (state)
    let mut by_category: HashMap<String, i64> = HashMap::new();
    for entry in &by_app {
        *by_category.entry(entry.state.clone()).or_insert(0) += entry.total_ms;
    }

    let total_ms: i64 = by_category.values().sum();

    Ok(RecapData {
        date: today,
        total_ms,
        by_app,
        by_category,
    })
}
