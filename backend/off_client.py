import requests
from fastapi import HTTPException

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"

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

    def _opt(key):
        v = nutr.get(key)
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

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
        "fiber_100g": _opt("fiber_100g"),
        "sugar_100g": _opt("sugars_100g"),
        "sodium_100g": _opt("sodium_100g"),
    }


_SEARCH_FIELDS = "code,product_name,generic_name,brands,image_url,nutriments,serving_quantity"
_search_cache: dict[str, tuple[float, list]] = {}
_SEARCH_CACHE_TTL = 600  # seconds


def _normalize_hits(products: list[dict]) -> list[dict]:
    results = []
    for p in products:
        code = p.get("code")
        if not code:
            continue
        # search-a-licious returns brands as a list
        if isinstance(p.get("brands"), list):
            p = {**p, "brands": ", ".join(p["brands"])}
        normalized = normalize_product(code, {"product": p})
        # skip entries with no usable nutrition at all
        if normalized["kcal_100g"] == 0 and normalized["protein_100g"] == 0:
            continue
        results.append(normalized)
    return results


def search_products(query: str, page_size: int = 12) -> list[dict]:
    """Free-text product search on OpenFoodFacts, normalized like fetch_product.

    Uses the dedicated search service (search.openfoodfacts.org) first and
    falls back to the classic cgi endpoint, which is heavily rate-limited.
    Successful results are cached briefly to spare both services."""
    import time

    key = query.lower()
    cached = _search_cache.get(key)
    if cached and time.time() - cached[0] < _SEARCH_CACHE_TTL:
        return cached[1]

    results = None
    try:
        r = requests.get(
            "https://search.openfoodfacts.org/search",
            params={"q": query, "page_size": page_size, "fields": _SEARCH_FIELDS},
            timeout=15,
            headers=OFF_HEADERS,
        )
        if r.status_code == 200:
            results = _normalize_hits(r.json().get("hits", []))
    except requests.RequestException:
        pass

    if results is None:
        try:
            r = requests.get(
                OFF_SEARCH_URL,
                params={
                    "search_terms": query,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": page_size,
                    "fields": _SEARCH_FIELDS,
                },
                timeout=15,
                headers=OFF_HEADERS,
            )
        except requests.RequestException:
            raise HTTPException(status_code=502, detail="Could not reach OpenFoodFacts")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Upstream API error")
        results = _normalize_hits(r.json().get("products", []))

    _search_cache[key] = (time.time(), results)
    return results


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
