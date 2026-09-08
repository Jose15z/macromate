from fastapi import APIRouter, Depends, HTTPException, Path, Query

from auth import get_current_user
from db import get_conn
from schemas import DATE_PATTERN, EntryCreate, EntryUpdate, InlineFood

router = APIRouter(prefix="/api", tags=["diary"])

MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"]
MACROS = ["kcal", "protein", "carbs", "fat"]


def per_grams(value_per_100g: float, grams: float) -> float:
    return (value_per_100g * grams) / 100.0


def _entry_dict(row) -> dict:
    grams = row["grams"]
    return {
        "id": row["id"],
        "food_id": row["food_id"],
        "date": row["date"],
        "meal_type": row["meal_type"],
        "grams": grams,
        "name": row["name"],
        "brand": row["brand"],
        "image_url": row["image_url"],
        "serving_size_g": row["serving_size_g"],
        "kcal": round(per_grams(row["kcal_100g"], grams), 1),
        "protein": round(per_grams(row["protein_100g"], grams), 1),
        "carbs": round(per_grams(row["carbs_100g"], grams), 1),
        "fat": round(per_grams(row["fat_100g"], grams), 1),
    }


def _resolve_food_id(conn, user_id: int, payload: EntryCreate) -> int:
    if payload.food_id is not None:
        row = conn.execute(
            "SELECT id FROM foods WHERE id = ? AND user_id = ?",
            (payload.food_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Food not found")
        return row["id"]

    food: InlineFood = payload.food
    if food.barcode:
        existing = conn.execute(
            "SELECT id FROM foods WHERE user_id = ? AND barcode = ?",
            (user_id, food.barcode),
        ).fetchone()
        if existing:
            # refresh stored nutrition with the latest values
            conn.execute(
                """
                UPDATE foods
                SET name = ?, brand = ?, image_url = ?, kcal_100g = ?,
                    protein_100g = ?, carbs_100g = ?, fat_100g = ?, serving_size_g = ?
                WHERE id = ?
                """,
                (
                    food.name.strip(),
                    food.brand.strip(),
                    food.image_url,
                    food.kcal_100g,
                    food.protein_100g,
                    food.carbs_100g,
                    food.fat_100g,
                    food.serving_size_g,
                    existing["id"],
                ),
            )
            return existing["id"]

    is_saved = food.is_saved if food.is_saved is not None else food.source != "ai"
    cur = conn.execute(
        """
        INSERT INTO foods (user_id, source, barcode, name, brand, image_url,
                           kcal_100g, protein_100g, carbs_100g, fat_100g,
                           serving_size_g, is_saved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            food.source,
            food.barcode,
            food.name.strip(),
            food.brand.strip(),
            food.image_url,
            food.kcal_100g,
            food.protein_100g,
            food.carbs_100g,
            food.fat_100g,
            food.serving_size_g,
            int(is_saved),
        ),
    )
    return cur.lastrowid


@router.post("/diary/entries", status_code=201)
def add_entry(payload: EntryCreate, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        food_id = _resolve_food_id(conn, user["id"], payload)
        cur = conn.execute(
            """
            INSERT INTO entries (user_id, food_id, date, meal_type, grams)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user["id"], food_id, payload.date, payload.meal_type, payload.grams),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT e.*, f.name, f.brand, f.image_url, f.serving_size_g,
                   f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g
            FROM entries e JOIN foods f ON f.id = e.food_id
            WHERE e.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        return _entry_dict(row)
    finally:
        conn.close()


@router.patch("/diary/entries/{entry_id}")
def update_entry(
    entry_id: int, payload: EntryUpdate, user: dict = Depends(get_current_user)
):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    conn = get_conn()
    try:
        owned = conn.execute(
            "SELECT id FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user["id"]),
        ).fetchone()
        if owned is None:
            raise HTTPException(status_code=404, detail="Entry not found")

        if fields:
            sets = ", ".join(f"{k} = ?" for k in fields)
            conn.execute(
                f"UPDATE entries SET {sets} WHERE id = ? AND user_id = ?",
                (*fields.values(), entry_id, user["id"]),
            )
            conn.commit()

        row = conn.execute(
            """
            SELECT e.*, f.name, f.brand, f.image_url, f.serving_size_g,
                   f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g
            FROM entries e JOIN foods f ON f.id = e.food_id
            WHERE e.id = ?
            """,
            (entry_id,),
        ).fetchone()
        return _entry_dict(row)
    finally:
        conn.close()


@router.delete("/diary/entries/{entry_id}")
def delete_entry(entry_id: int, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"ok": True}
    finally:
        conn.close()


@router.get("/diary/summary")
def diary_summary(
    user: dict = Depends(get_current_user),
    start: str = Query(pattern=DATE_PATTERN),
    end: str = Query(pattern=DATE_PATTERN),
):
    """Daily totals for a date range (inclusive) — for history views."""
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT e.date,
                   SUM(f.kcal_100g * e.grams / 100.0) AS kcal,
                   SUM(f.protein_100g * e.grams / 100.0) AS protein,
                   SUM(f.carbs_100g * e.grams / 100.0) AS carbs,
                   SUM(f.fat_100g * e.grams / 100.0) AS fat
            FROM entries e JOIN foods f ON f.id = e.food_id
            WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
            GROUP BY e.date
            ORDER BY e.date
            """,
            (user["id"], start, end),
        ).fetchall()
        return {
            "days": [
                {
                    "date": r["date"],
                    **{m: round(r[m], 1) for m in MACROS},
                }
                for r in rows
            ]
        }
    finally:
        conn.close()


@router.get("/diary/{date}")
def get_day(
    user: dict = Depends(get_current_user),
    date: str = Path(pattern=DATE_PATTERN),
):
    conn = get_conn()
    try:
        profile = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        rows = conn.execute(
            """
            SELECT e.*, f.name, f.brand, f.image_url, f.serving_size_g,
                   f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g
            FROM entries e JOIN foods f ON f.id = e.food_id
            WHERE e.user_id = ? AND e.date = ?
            ORDER BY e.created_at
            """,
            (user["id"], date),
        ).fetchall()
    finally:
        conn.close()

    goals = {
        "kcal": profile["kcal_goal"],
        "protein": profile["protein_goal"],
        "carbs": profile["carbs_goal"],
        "fat": profile["fat_goal"],
    }

    meals = {m: {"meal_type": m, "entries": [], "totals": dict.fromkeys(MACROS, 0.0)} for m in MEAL_TYPES}
    totals = dict.fromkeys(MACROS, 0.0)

    for row in rows:
        entry = _entry_dict(row)
        meal = meals[entry["meal_type"]]
        meal["entries"].append(entry)
        for m in MACROS:
            meal["totals"][m] += entry[m]
            totals[m] += entry[m]

    for meal in meals.values():
        meal["totals"] = {m: round(v, 1) for m, v in meal["totals"].items()}
    totals = {m: round(v, 1) for m, v in totals.items()}
    remaining = {m: round(goals[m] - totals[m], 1) for m in MACROS}

    return {
        "date": date,
        "goals": goals,
        "totals": totals,
        "remaining": remaining,
        "meals": [meals[m] for m in MEAL_TYPES],
    }
