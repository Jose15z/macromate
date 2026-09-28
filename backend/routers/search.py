from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from off_client import search_products

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search-products")
def search(
    q: str = Query(min_length=2, max_length=100),
    user: dict = Depends(get_current_user),
):
    """Free-text product search on OpenFoodFacts (no barcode needed)."""
    return {"products": search_products(q.strip())}
