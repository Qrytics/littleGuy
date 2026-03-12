use std::collections::HashMap;

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Companion theme catalogue
// ---------------------------------------------------------------------------

/// Maps companion_type slug → (hair, skin, shirt, pants, shoes)
pub static COMPANION_TYPES: Lazy<HashMap<&'static str, CompanionTheme>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert(
        "default",
        CompanionTheme {
            label: "littleGuy (Blue)",
            hair: "#3b2314",
            skin: "#f5c5a3",
            shirt: "#4a90d9",
            pants: "#2c3e6b",
            shoes: "#1a1a2e",
        },
    );
    m.insert(
        "purple",
        CompanionTheme {
            label: "Viola (Purple)",
            hair: "#1a0a2e",
            skin: "#f5c5a3",
            shirt: "#8e44ad",
            pants: "#4a235a",
            shoes: "#1a0a2e",
        },
    );
    m.insert(
        "orange",
        CompanionTheme {
            label: "Rusty (Orange)",
            hair: "#5c1a00",
            skin: "#ffe0b2",
            shirt: "#e67e22",
            pants: "#784212",
            shoes: "#3e200a",
        },
    );
    m.insert(
        "red",
        CompanionTheme {
            label: "Scarlet (Red)",
            hair: "#1c0000",
            skin: "#f5c5a3",
            shirt: "#c0392b",
            pants: "#641e16",
            shoes: "#1c0000",
        },
    );
    m.insert(
        "green",
        CompanionTheme {
            label: "Mossy (Green)",
            hair: "#0a1f00",
            skin: "#d5e8c4",
            shirt: "#27ae60",
            pants: "#145a32",
            shoes: "#0a1f00",
        },
    );
    m
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionTheme {
    pub label: &'static str,
    pub hair: &'static str,
    pub skin: &'static str,
    pub shirt: &'static str,
    pub pants: &'static str,
    pub shoes: &'static str,
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Companion {
    pub id: String,
    pub name: String,
    pub companion_type: String,
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub autostart: bool,
    pub walking_mode: bool,
    pub idle_threshold_secs: u64,
    pub show_dialogue: bool,
    pub buddy_mode: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            autostart: false,
            walking_mode: false,
            idle_threshold_secs: 120,
            show_dialogue: true,
            buddy_mode: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS companions (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    companion_type TEXT NOT NULL DEFAULT 'default',
    x              INTEGER NOT NULL DEFAULT 100,
    y              INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)
        .context("create companion_store tables")?;

    // Seed default companion if the table is empty
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM companions", [], |r| r.get(0))
        .context("count companions")?;

    if count == 0 {
        conn.execute(
            "INSERT INTO companions (id, name, companion_type, x, y) VALUES (?1, ?2, ?3, ?4, ?5)",
            params!["companion-1", "littleGuy", "default", 100, 100],
        )
        .context("seed default companion")?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

pub fn get_all(conn: &Connection) -> Result<Vec<Companion>> {
    let mut stmt = conn
        .prepare("SELECT id, name, companion_type, x, y FROM companions ORDER BY rowid")
        .context("prepare get_all companions")?;

    let companions = stmt
        .query_map([], |row| {
            Ok(Companion {
                id: row.get(0)?,
                name: row.get(1)?,
                companion_type: row.get(2)?,
                x: row.get(3)?,
                y: row.get(4)?,
            })
        })
        .context("query companions")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("collect companions")?;

    Ok(companions)
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Companion>> {
    let mut stmt = conn
        .prepare("SELECT id, name, companion_type, x, y FROM companions WHERE id = ?1")
        .context("prepare get_by_id")?;

    let mut rows = stmt
        .query_map([id], |row| {
            Ok(Companion {
                id: row.get(0)?,
                name: row.get(1)?,
                companion_type: row.get(2)?,
                x: row.get(3)?,
                y: row.get(4)?,
            })
        })
        .context("query companion by id")?;

    Ok(rows.next().transpose().context("fetch companion by id")?)
}

pub fn add(conn: &Connection) -> Result<Companion> {
    let id = format!("companion-{}", Uuid::new_v4());
    let companion = Companion {
        id: id.clone(),
        name: "newGuy".to_string(),
        companion_type: "default".to_string(),
        x: 200,
        y: 200,
    };

    conn.execute(
        "INSERT INTO companions (id, name, companion_type, x, y) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            companion.id,
            companion.name,
            companion.companion_type,
            companion.x,
            companion.y,
        ],
    )
    .context("insert companion")?;

    Ok(companion)
}

pub fn remove(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM companions WHERE id = ?1", [id])
        .context("delete companion")?;
    Ok(())
}

pub fn update(
    conn: &Connection,
    id: &str,
    name: Option<&str>,
    companion_type: Option<&str>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<()> {
    if let Some(n) = name {
        conn.execute(
            "UPDATE companions SET name = ?1 WHERE id = ?2",
            params![n, id],
        )
        .context("update companion name")?;
    }
    if let Some(ct) = companion_type {
        conn.execute(
            "UPDATE companions SET companion_type = ?1 WHERE id = ?2",
            params![ct, id],
        )
        .context("update companion type")?;
    }
    if let Some(xv) = x {
        conn.execute(
            "UPDATE companions SET x = ?1 WHERE id = ?2",
            params![xv, id],
        )
        .context("update companion x")?;
    }
    if let Some(yv) = y {
        conn.execute(
            "UPDATE companions SET y = ?1 WHERE id = ?2",
            params![yv, id],
        )
        .context("update companion y")?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

pub fn get_settings(conn: &Connection) -> Result<Settings> {
    let get = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |r| r.get(0),
        )
        .ok()
    };

    Ok(Settings {
        autostart: get("autostart")
            .map(|v| v == "true")
            .unwrap_or(false),
        walking_mode: get("walking_mode")
            .map(|v| v == "true")
            .unwrap_or(false),
        idle_threshold_secs: get("idle_threshold_secs")
            .and_then(|v| v.parse().ok())
            .unwrap_or(120),
        show_dialogue: get("show_dialogue")
            .map(|v| v == "true")
            .unwrap_or(true),
        buddy_mode: get("buddy_mode")
            .map(|v| v == "true")
            .unwrap_or(false),
    })
}

pub fn update_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .context("upsert setting")?;
    Ok(())
}
