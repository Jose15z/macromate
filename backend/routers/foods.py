from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import get_conn
from schemas import FoodCreate, FoodUpdate

router = APIRouter(prefix="/api", tags=["foods"])


def food_dict(row) -> dict:
    return {
        "id": row["id"],
        "source": row["source"],
        "barcode": row["barcode"],
        "name": row["name"],
        "brand": row["brand"],
        "image_url": row["image_url"],
        "kcal_100g": row["kcal_100g"],
        "protein_100g": row["protein_100g"],
        "carbs_100g": row["carbs_100g"],
        "fat_100g": row["fat_100g"],
        "serving_size_g": row["serving_size_g"],
        "is_saved": bool(row["is_saved"]),
    }


def _get_owned_food(conn, user_id: int, food_id: int):
    row = conn.execute(
        "SELECT * FROM foods WHERE id = ? AND user_id = ?", (food_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Food not found")
    return row


@router.post("/foods", status_code=201)
def create_food(payload: FoodCreate, user: dict = Depends(get_current_user)):
    macros = payload.per_100g()
    conn = get_conn()
    try:
        if payload.barcode:
            existing = conn.execute(
                "SELECT id FROM foods WHERE user_id = ? AND barcode = ?",
                (user["id"], payload.barcode),
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=409, detail="A food with this barcode already exists"
                )

        cur = conn.execute(
            """
            INSERT INTO foods (user_id, source, barcode, name, brand, image_url,
                               kcal_100g, protein_100g, carbs_100g, fat_100g,
                               serving_size_g, is_saved)
            VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                user["id"],
                payload.barcode,
                payload.name.strip(),
                payload.brand.strip(),
                payload.image_url,
                macros["kcal_100g"],
                macros["protein_100g"],
                macros["carbs_100g"],
                macros["fat_100g"],
                payload.serving_size_g,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM foods WHERE id = ?", (cur.lastrowid,)).fetchone()
        return food_dict(row)
    finally:
        conn.close()


@router.get("/foods")
def list_foods(
    user: dict = Depends(get_current_user),
    list_type: Literal["saved", "recent", "frequent", "scanned"] = Query(
        default="saved", alias="list"
    ),
    search: Optional[str] = Query(default=None, max_length=100),
):
    conn = get_conn()
    try:
        params: list = [user["id"]]
        if list_type == "saved":
            sql = "SELECT * FROM foods WHERE user_id = ? AND is_saved = 1"
        elif list_type == "scanned":
            sql = "SELECT * FROM foods WHERE user_id = ? AND source = 'off'"
        else:
            order = (
                "MAX(e.created_at) DESC"
                if list_type == "recent"
                else "COUNT(e.id) DESC, MAX(e.created_at) DESC"
            )
            sql = """
                SELECT f.*
                FROM foods f
                JOIN entries e ON e.food_id = f.id
                WHERE f.user_id = ?
            """
            if search:
                sql += " AND (f.name LIKE ? OR f.brand LIKE ?)"
                like = f"%{search.strip()}%"
                params.extend([like, like])
            sql += f" GROUP BY f.id ORDER BY {order} LIMIT 30"
            rows = conn.execute(sql, params).fetchall()
            return {"foods": [food_dict(r) for r in rows]}

        if search:
            sql += " AND (name LIKE ? OR brand LIKE ?)"
            like = f"%{search.strip()}%"
            params.extend([like, like])
        sql += " ORDER BY created_at DESC LIMIT 100" if list_type == "scanned" else " ORDER BY name LIMIT 100"
        rows = conn.execute(sql, params).fetchall()
        return {"foods": [food_dict(r) for r in rows]}
    finally:
        conn.close()


@router.put("/foods/{food_id}")
def update_food(
    food_id: int, payload: FoodUpdate, user: dict = Depends(get_current_user)
):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "is_saved" in fields:
        fields["is_saved"] = int(fields["is_saved"])
    conn = get_conn()
    try:
        _get_owned_food(conn, user["id"], food_id)
        if fields:
            sets = ", ".join(f"{k} = ?" for k in fields)
            conn.execute(
                f"UPDATE foods SET {sets} WHERE id = ? AND user_id = ?",
                (*fields.values(), food_id, user["id"]),
            )
            conn.commit()
        row = conn.execute("SELECT * FROM foods WHERE id = ?", (food_id,)).fetchone()
        return food_dict(row)
    finally:
        conn.close()


@router.delete("/foods/{food_id}")
def delete_food(food_id: int, user: dict = Depends(get_current_user)):
    """Remove a food from the library. If it has logged entries, it is hidden
    (is_saved = 0) so diary history stays intact; otherwise it is deleted."""
    conn = get_conn()
    try:
        _get_owned_food(conn, user["id"], food_id)
        used = conn.execute(
            "SELECT 1 FROM entries WHERE food_id = ? LIMIT 1", (food_id,)
        ).fetchone()
        if used:
            conn.execute(
                "UPDATE foods SET is_saved = 0 WHERE id = ? AND user_id = ?",
                (food_id, user["id"]),
            )
            hidden = True
        else:
            conn.execute(
                "DELETE FROM foods WHERE id = ? AND user_id = ?",
                (food_id, user["id"]),
            )
            hidden = False
        conn.commit()
        return {"ok": True, "hidden": hidden}
    finally:
        conn.close()
