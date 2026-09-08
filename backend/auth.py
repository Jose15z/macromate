import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import get_conn

TOKEN_TTL_DAYS = 30
PBKDF2_ITERATIONS = 200_000

_bearer = HTTPBearer(auto_error=False)


def _utc_now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, digest)


def create_token(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = _iso(_utc_now() + timedelta(days=TOKEN_TTL_DAYS))
    conn.execute(
        "INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    return token


def revoke_token(conn, token: str):
    conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))


def get_bearer_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return creds.credentials


def get_current_user(token: str = Depends(get_bearer_token)) -> dict:
    conn = get_conn()
    try:
        row = conn.execute(
            """
            SELECT u.id, u.email
            FROM auth_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ? AND t.expires_at > ?
            """,
            (token, _iso(_utc_now())),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"id": row["id"], "email": row["email"]}
