from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import auth_routes, diary, foods, products, recognize

app = FastAPI(title="MacroMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev; restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(auth_routes.router)
app.include_router(products.router)
app.include_router(foods.router)
app.include_router(diary.router)
app.include_router(recognize.router)


@app.get("/api/health")
def health():
    return {"ok": True}
