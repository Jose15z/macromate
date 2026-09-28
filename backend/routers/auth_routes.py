import html
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

import emailer
from auth import (
    create_token,
    get_bearer_token,
    get_current_user,
    hash_password,
    revoke_token,
    verify_password,
)
from db import get_conn, insert_and_get_id
from schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    ResetPasswordRequest,
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://mcrmt.vercel.app").rstrip("/")
RESET_TTL_MINUTES = 30

router = APIRouter(prefix="/api", tags=["auth"])


def _profile_dict(row) -> dict:
    return {
        "display_name": row["display_name"],
        "kcal_goal": row["kcal_goal"],
        "protein_goal": row["protein_goal"],
        "carbs_goal": row["carbs_goal"],
        "fat_goal": row["fat_goal"],
    }


def _auth_response(conn, user_id: int, email: str) -> dict:
    token = create_token(conn, user_id)
    profile = conn.execute(
        "SELECT * FROM profiles WHERE user_id = ?", (user_id,)
    ).fetchone()
    return {
        "token": token,
        "user": {"id": user_id, "email": email},
        "profile": _profile_dict(profile),
    }


@router.post("/auth/register", status_code=201)
def register(payload: RegisterRequest):
    email = payload.email.lower()
    conn = get_conn()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = insert_and_get_id(
            conn,
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, hash_password(payload.password)),
        )
        conn.execute(
            "INSERT INTO profiles (user_id, display_name) VALUES (?, ?)",
            (user_id, payload.display_name.strip()),
        )
        result = _auth_response(conn, user_id, email)
        conn.commit()
        return result
    finally:
        conn.close()


@router.post("/auth/login")
def login(payload: LoginRequest):
    conn = get_conn()
    try:
        user = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (payload.email.lower(),),
        ).fetchone()
        if user is None or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        result = _auth_response(conn, user["id"], user["email"])
        conn.commit()
        return result
    finally:
        conn.close()


@router.post("/auth/logout")
def logout(token: str = Depends(get_bearer_token)):
    conn = get_conn()
    try:
        revoke_token(conn, token)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/auth/forgot")
def forgot_password(payload: ForgotPasswordRequest):
    if not emailer.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Password reset emails are not configured on this server",
        )

    conn = get_conn()
    try:
        user = conn.execute(
            "SELECT id, email FROM users WHERE email = ?", (payload.email.lower(),)
        ).fetchone()
        if user:
            token = secrets.token_urlsafe(32)
            expires = (
                datetime.now(timezone.utc) + timedelta(minutes=RESET_TTL_MINUTES)
            ).strftime("%Y-%m-%dT%H:%M:%S")
            conn.execute("DELETE FROM password_resets WHERE user_id = ?", (user["id"],))
            conn.execute(
                "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)",
                (token, user["id"], expires),
            )
            conn.commit()
            link = f"{FRONTEND_URL}/reset?token={token}"
            emailer.send_email(
                user["email"],
                "Reset your MacroMate password",
                f"""<p>Someone requested a password reset for this MacroMate account.</p>
                <p><a href="{html.escape(link)}">Choose a new password</a>
                (the link expires in {RESET_TTL_MINUTES} minutes).</p>
                <p>If it wasn't you, you can ignore this email.</p>""",
            )
    finally:
        conn.close()

    # same answer whether or not the account exists
    return {"ok": True}


@router.post("/auth/reset")
def reset_password(payload: ResetPasswordRequest):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT user_id FROM password_resets WHERE token = ? AND expires_at > ?",
            (payload.token, now),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")

        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.password), row["user_id"]),
        )
        # invalidate the reset link and every existing session
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (row["user_id"],))
        conn.execute("DELETE FROM auth_tokens WHERE user_id = ?", (row["user_id"],))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.put("/me/password")
def change_password(
    payload: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user["id"],)
        ).fetchone()
        if not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=403, detail="Current password is incorrect")

        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.new_password), user["id"]),
        )
        # log out every other device, keep this session
        conn.execute(
            "DELETE FROM auth_tokens WHERE user_id = ? AND token != ?",
            (user["id"], token),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/me/delete")
def delete_account(
    payload: DeleteAccountRequest, user: dict = Depends(get_current_user)
):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user["id"],)
        ).fetchone()
        if not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=403, detail="Password is incorrect")

        # FK cascades remove profile, tokens, foods, entries, weights, recipes
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        profile = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        return {"user": user, "profile": _profile_dict(profile)}
    finally:
        conn.close()


@router.put("/me")
def update_me(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    conn = get_conn()
    try:
        if fields:
            sets = ", ".join(f"{k} = ?" for k in fields)
            conn.execute(
                f"UPDATE profiles SET {sets} WHERE user_id = ?",
                (*fields.values(), user["id"]),
            )
            conn.commit()
        profile = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        return {"user": user, "profile": _profile_dict(profile)}
    finally:
        conn.close()
