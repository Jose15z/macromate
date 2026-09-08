import requests
from fastapi import HTTPException

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"

# OpenFoodFacts rejects requests without an identifying User-Agent (403)
OFF_HEADERS = {"User-Agent": "MacroMate/1.0 (personal nutrition tracker)"}


def _f(nutriments: dict, key: str) -> float:
    v = nutriments.get(key)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def normalize_product(barcode: str, data: dict) -> dict:
    p = data.get("product", {}) or {}
    nutr = p.get("nutriments", {}) or {}

    name = p.get("product_name") or p.get("generic_name") or "Unknown product"
    brand = p.get("brands") or ""
    image = p.get("image_url") or ""

    serving_size_g = None
    try:
        q = float(p.get("serving_quantity"))
        if q > 0:
            serving_size_g = q
    except (TypeError, ValueError):
        pass

    # macros per 100g (OFF standard)
    return {
        "barcode": barcode,
        "name": name,
        "brand": brand,
        "image": image,
        "kcal_100g": _f(nutr, "energy-kcal_100g"),
        "protein_100g": _f(nutr, "proteins_100g"),
        "carbs_100g": _f(nutr, "carbohydrates_100g"),
        "fat_100g": _f(nutr, "fat_100g"),
        "serving_size_g": serving_size_g,
    }


def fetch_product(barcode: str) -> dict:
    try:
        r = requests.get(OFF_URL.format(barcode=barcode), timeout=10, headers=OFF_HEADERS)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach OpenFoodFacts")

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Upstream API error")

    data = r.json()
    if data.get("status") != 1:
        raise HTTPException(status_code=404, detail="Product not found")

    return normalize_product(barcode, data)
