from fastapi import APIRouter, Depends, HTTPException

from auth import (
    create_token,
    get_bearer_token,
    get_current_user,
    hash_password,
    revoke_token,
    verify_password,
)
from db import get_conn
from schemas import LoginRequest, ProfileUpdate, RegisterRequest

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
    conn = get_conn()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (payload.email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        cur = conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (payload.email.lower(), hash_password(payload.password)),
        )
        user_id = cur.lastrowid
        conn.execute(
            "INSERT INTO profiles (user_id, display_name) VALUES (?, ?)",
            (user_id, payload.display_name.strip()),
        )
        result = _auth_response(conn, user_id, payload.email.lower())
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
            (payload.email,),
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
