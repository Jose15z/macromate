from fastapi import APIRouter, Depends

from auth import get_current_user
from db import get_conn
from off_client import fetch_product

router = APIRouter(prefix="/api", tags=["products"])


@router.get("/product/{barcode}")
def get_product(barcode: str, user: dict = Depends(get_current_user)):
    """Look up a product on OpenFoodFacts. If the user already has a food for
    this barcode, its id is included so the client can reuse it."""
    product = fetch_product(barcode)

    conn = get_conn()
    try:
        existing = conn.execute(
            "SELECT id FROM foods WHERE user_id = ? AND barcode = ?",
            (user["id"], barcode),
        ).fetchone()
    finally:
        conn.close()

    product["food_id"] = existing["id"] if existing else None
    return product
