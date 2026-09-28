from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user
from db import get_conn
from recognition import gemini_structured
from schemas import SuggestRequest

router = APIRouter(prefix="/api", tags=["ai"])


class Suggestion(BaseModel):
    name: str
    description: str
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class SuggestOutput(BaseModel):
    suggestions: list[Suggestion]


SUGGEST_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "suggestions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING", "description": "Short dish name"},
                    "description": {
                        "type": "STRING",
                        "description": "One sentence: main ingredients and rough portions",
                    },
                    "kcal": {"type": "NUMBER"},
                    "protein_g": {"type": "NUMBER"},
                    "carbs_g": {"type": "NUMBER"},
                    "fat_g": {"type": "NUMBER"},
                },
                "required": ["name", "description", "kcal", "protein_g", "carbs_g", "fat_g"],
            },
        }
    },
    "required": ["suggestions"],
}

MEAL_NAMES = {
    "en": {"breakfast": "breakfast", "lunch": "lunch", "dinner": "dinner", "snack": "a snack"},
    "es": {"breakfast": "el desayuno", "lunch": "el almuerzo", "dinner": "la cena", "snack": "una merienda"},
}


@router.post("/suggest")
def suggest(payload: SuggestRequest, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        profile = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        totals = conn.execute(
            """
            SELECT COALESCE(SUM(f.kcal_100g * e.grams / 100.0), 0) AS kcal,
                   COALESCE(SUM(f.protein_100g * e.grams / 100.0), 0) AS protein,
                   COALESCE(SUM(f.carbs_100g * e.grams / 100.0), 0) AS carbs,
                   COALESCE(SUM(f.fat_100g * e.grams / 100.0), 0) AS fat
            FROM entries e JOIN foods f ON f.id = e.food_id
            WHERE e.user_id = ? AND e.date = ?
            """,
            (user["id"], payload.date),
        ).fetchone()
    finally:
        conn.close()

    remaining = {
        "kcal": max(0, round(profile["kcal_goal"] - totals["kcal"])),
        "protein": max(0, round(profile["protein_goal"] - totals["protein"])),
        "carbs": max(0, round(profile["carbs_goal"] - totals["carbs"])),
        "fat": max(0, round(profile["fat_goal"] - totals["fat"])),
    }

    meal_name = MEAL_NAMES[payload.lang][payload.meal_type]
    if payload.lang == "es":
        prompt = (
            f"Eres un asistente de nutrición. A la persona le quedan hoy aproximadamente "
            f"{remaining['kcal']} kcal, {remaining['protein']} g de proteína, "
            f"{remaining['carbs']} g de carbohidratos y {remaining['fat']} g de grasa, "
            f"y está planeando {meal_name}. Sugiere 3 platos realistas y fáciles de "
            f"preparar en casa con ingredientes comunes, que encajen razonablemente en "
            f"esos valores (no hace falta que los agoten). Responde en español."
        )
    else:
        prompt = (
            f"You are a nutrition assistant. The person has roughly {remaining['kcal']} kcal, "
            f"{remaining['protein']} g protein, {remaining['carbs']} g carbs and "
            f"{remaining['fat']} g fat left today and is planning {meal_name}. Suggest 3 "
            f"realistic, home-cookable dishes with common ingredients that fit reasonably "
            f"within those remaining targets (they don't need to use them all up). "
            f"Respond in English."
        )

    text, error = gemini_structured([{"text": prompt}], SUGGEST_SCHEMA)

    if error == "not_configured":
        return {
            "available": False,
            "suggestions": [],
            "remaining": remaining,
            "message": "AI suggestions need GEMINI_API_KEY configured on the server.",
        }
    if error is not None:
        return {
            "available": True,
            "suggestions": [],
            "remaining": remaining,
            "message": f"Suggestions are temporarily unavailable ({error}).",
        }

    try:
        output = SuggestOutput.model_validate_json(text)
    except ValueError:
        return {
            "available": True,
            "suggestions": [],
            "remaining": remaining,
            "message": "Could not generate suggestions — try again.",
        }

    return {
        "available": True,
        "suggestions": [s.model_dump() for s in output.suggestions[:3]],
        "remaining": remaining,
        "message": "",
    }
