from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth import get_current_user
from recognition import get_provider

router = APIRouter(prefix="/api", tags=["recognition"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/recognize")
async def recognize_photo(
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    media_type = image.content_type or ""
    if media_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Use JPEG, PNG, GIF or WebP.",
        )

    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image larger than 10 MB")
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload")

    provider = get_provider()
    result = provider.recognize(data, media_type)
    return result.model_dump()
