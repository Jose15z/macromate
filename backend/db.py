import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "macromate.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL DEFAULT '',
        kcal_goal REAL NOT NULL DEFAULT 2000,
        protein_goal REAL NOT NULL DEFAULT 150,
        carbs_goal REAL NOT NULL DEFAULT 250,
        fat_goal REAL NOT NULL DEFAULT 70
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('off', 'manual', 'ai')),
        barcode TEXT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        kcal_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        serving_size_g REAL,
        is_saved INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_user_barcode
        ON foods(user_id, barcode) WHERE barcode IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id);

    CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
        grams REAL NOT NULL CHECK (grams > 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
    """)
    conn.commit()
    conn.close()
