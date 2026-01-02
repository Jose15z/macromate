from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from datetime import date
from db import init_db, get_conn

app = FastAPI(title="MacroMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # para dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"

def normalize_product(barcode: str, data: dict) -> dict:
    p = data.get("product", {}) or {}
    nutr = p.get("nutriments", {}) or {}

    # OpenFoodFacts a veces trae claves diferentes; usamos defaults seguros
    name = p.get("product_name") or p.get("generic_name") or "Unknown product"
    brand = p.get("brands") or ""
    image = p.get("image_url") or ""

    def f(key):
        v = nutr.get(key)
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    # macros por 100g (estándar OFF)
    return {
        "barcode": barcode,
        "name": name,
        "brand": brand,
        "image": image,
        "kcal_100g": f("energy-kcal_100g"),
        "protein_100g": f("proteins_100g"),
        "carbs_100g": f("carbohydrates_100g"),
        "fat_100g": f("fat_100g"),
    }

@app.get("/api/product/{barcode}")
def get_product(barcode: str):
    r = requests.get(OFF_URL.format(barcode=barcode), timeout=10)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Upstream API error")

    data = r.json()
    if data.get("status") != 1:
        raise HTTPException(status_code=404, detail="Product not found")

    return normalize_product(barcode, data)

class AddConsumption(BaseModel):
    barcode: str
    product_name: str
    grams: float
    kcal_100g: float
    protein_100g: float
    carbs_100g: float
    fat_100g: float
    date: str | None = None  # YYYY-MM-DD

def per_grams(value_per_100g: float, grams: float) -> float:
    return (value_per_100g * grams) / 100.0

@app.post("/api/day/add")
def add_to_day(payload: AddConsumption):
    d = payload.date or date.today().isoformat()

    kcal = per_grams(payload.kcal_100g, payload.grams)
    protein = per_grams(payload.protein_100g, payload.grams)
    carbs = per_grams(payload.carbs_100g, payload.grams)
    fat = per_grams(payload.fat_100g, payload.grams)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO consumptions (date, barcode, product_name, grams, kcal, protein, carbs, fat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (d, payload.barcode, payload.product_name, payload.grams, kcal, protein, carbs, fat))
    conn.commit()
    conn.close()

    return {"ok": True, "date": d}

@app.get("/api/day/{day}")
def get_day(day: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT barcode, product_name, grams, kcal, protein, carbs, fat
        FROM consumptions
        WHERE date = ?
        ORDER BY id DESC
    """, (day,))
    rows = cur.fetchall()
    conn.close()

    items = []
    totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}

    for (barcode, name, grams, kcal, protein, carbs, fat) in rows:
        items.append({
            "barcode": barcode,
            "name": name,
            "grams": grams,
            "kcal": kcal,
            "protein": protein,
            "carbs": carbs,
            "fat": fat,
        })
        totals["kcal"] += kcal
        totals["protein"] += protein
        totals["carbs"] += carbs
        totals["fat"] += fat

    # redondeo friendly
    totals = {k: round(v, 1) for k, v in totals.items()}
    return {"date": day, "totals": totals, "items": items}
