"""Database access layer.

Two interchangeable drivers:
- SQLite (default) — zero-config local development, file next to this module.
- PostgreSQL — used automatically when the DATABASE_URL env var is set
  (e.g. on Render), so data survives deploys and restarts.

Routers use the sqlite paramstyle ("?" placeholders) and access rows by
column name; the thin wrapper below translates for psycopg.
"""

import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "macromate.db"

DATABASE_URL = os.environ.get("DATABASE_URL", "")
IS_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))


class _PgCursor:
    def __init__(self, cursor):
        self._cur = cursor

    @property
    def rowcount(self):
        return self._cur.rowcount

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


class _PgConn:
    """Adapts a psycopg connection to the sqlite3 API surface the app uses."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return _PgCursor(self._conn.execute(sql.replace("?", "%s"), params))

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_conn():
    if IS_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        return _PgConn(psycopg.connect(DATABASE_URL, row_factory=dict_row))

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def insert_and_get_id(conn, sql, params=()):
    """INSERT and return the new row's id on both drivers."""
    if IS_POSTGRES:
        return conn.execute(sql + " RETURNING id", params).fetchone()["id"]
    return conn.execute(sql, params).lastrowid


_SQLITE_SCHEMA = """
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
"""

# Same shape for PostgreSQL. Timestamps stay ISO-8601 TEXT so ordering and
# expiry comparisons behave identically on both drivers.
_PG_NOW = "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS')"

_PG_SCHEMA = f"""
    CREATE TABLE IF NOT EXISTS users (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW}
    );

    CREATE TABLE IF NOT EXISTS profiles (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL DEFAULT '',
        kcal_goal DOUBLE PRECISION NOT NULL DEFAULT 2000,
        protein_goal DOUBLE PRECISION NOT NULL DEFAULT 150,
        carbs_goal DOUBLE PRECISION NOT NULL DEFAULT 250,
        fat_goal DOUBLE PRECISION NOT NULL DEFAULT 70
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW},
        expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS foods (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('off', 'manual', 'ai')),
        barcode TEXT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        kcal_100g DOUBLE PRECISION NOT NULL,
        protein_100g DOUBLE PRECISION NOT NULL,
        carbs_100g DOUBLE PRECISION NOT NULL,
        fat_100g DOUBLE PRECISION NOT NULL,
        serving_size_g DOUBLE PRECISION,
        is_saved INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_user_barcode
        ON foods(user_id, barcode) WHERE barcode IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id);

    CREATE TABLE IF NOT EXISTS entries (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        food_id BIGINT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
        grams DOUBLE PRECISION NOT NULL CHECK (grams > 0),
        created_at TEXT NOT NULL DEFAULT {_PG_NOW}
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
"""


def init_db():
    if IS_POSTGRES:
        import psycopg

        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                for statement in _PG_SCHEMA.split(";"):
                    if statement.strip():
                        cur.execute(statement)
        return

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(_SQLITE_SCHEMA)
    conn.commit()
    conn.close()
