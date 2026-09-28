from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from db import get_conn, insert_and_get_id
from schemas import RecipeCreate, RecipeLogRequest

router = APIRouter(prefix="/api", tags=["recipes"])


def _recipe_with_items(conn, user_id: int, recipe_id: int) -> dict:
    recipe = conn.execute(
        "SELECT id, name FROM recipes WHERE id = ? AND user_id = ?",
        (recipe_id, user_id),
    ).fetchone()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    rows = conn.execute(
        """
        SELECT ri.id, ri.grams, f.id AS food_id, f.name, f.brand, f.image_url,
               f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g
        FROM recipe_items ri JOIN foods f ON f.id = ri.food_id
        WHERE ri.recipe_id = ?
        ORDER BY ri.id
        """,
        (recipe_id,),
    ).fetchall()

    items = []
    totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    for r in rows:
        g = r["grams"]
        item = {
            "id": r["id"],
            "food_id": r["food_id"],
            "name": r["name"],
            "brand": r["brand"],
            "image_url": r["image_url"],
            "grams": g,
            "kcal": round(r["kcal_100g"] * g / 100.0, 1),
            "protein": round(r["protein_100g"] * g / 100.0, 1),
            "carbs": round(r["carbs_100g"] * g / 100.0, 1),
            "fat": round(r["fat_100g"] * g / 100.0, 1),
        }
        for m in totals:
            totals[m] += item[m]
        items.append(item)

    return {
        "id": recipe["id"],
        "name": recipe["name"],
        "items": items,
        "totals": {m: round(v, 1) for m, v in totals.items()},
    }


@router.get("/recipes")
def list_recipes(user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        ids = conn.execute(
            "SELECT id FROM recipes WHERE user_id = ? ORDER BY name", (user["id"],)
        ).fetchall()
        return {"recipes": [_recipe_with_items(conn, user["id"], r["id"]) for r in ids]}
    finally:
        conn.close()


@router.post("/recipes", status_code=201)
def create_recipe(payload: RecipeCreate, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        # every referenced food must belong to the user
        for item in payload.items:
            owned = conn.execute(
                "SELECT 1 FROM foods WHERE id = ? AND user_id = ?",
                (item.food_id, user["id"]),
            ).fetchone()
            if owned is None:
                raise HTTPException(status_code=404, detail="Food not found")

        recipe_id = insert_and_get_id(
            conn,
            "INSERT INTO recipes (user_id, name) VALUES (?, ?)",
            (user["id"], payload.name.strip()),
        )
        for item in payload.items:
            conn.execute(
                "INSERT INTO recipe_items (recipe_id, food_id, grams) VALUES (?, ?, ?)",
                (recipe_id, item.food_id, item.grams),
            )
        conn.commit()
        return _recipe_with_items(conn, user["id"], recipe_id)
    finally:
        conn.close()


@router.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM recipes WHERE id = ? AND user_id = ?",
            (recipe_id, user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Recipe not found")
        return {"ok": True}
    finally:
        conn.close()


@router.post("/recipes/{recipe_id}/log", status_code=201)
def log_recipe(
    recipe_id: int, payload: RecipeLogRequest, user: dict = Depends(get_current_user)
):
    """Add every ingredient of the recipe to the diary, scaled by `factor`.
    Entries stay individual so they can be edited or removed one by one."""
    conn = get_conn()
    try:
        recipe = _recipe_with_items(conn, user["id"], recipe_id)
        for item in recipe["items"]:
            conn.execute(
                """
                INSERT INTO entries (user_id, food_id, date, meal_type, grams)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    item["food_id"],
                    payload.date,
                    payload.meal_type,
                    round(item["grams"] * payload.factor, 1),
                ),
            )
        conn.commit()
        return {"logged": len(recipe["items"])}
    finally:
        conn.close()
