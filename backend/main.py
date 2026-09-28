from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import ai, auth_routes, diary, foods, products, recipes, recognize, search, weights

app = FastAPI(title="MacroMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://mcrmt.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(auth_routes.router)
app.include_router(products.router)
app.include_router(foods.router)
app.include_router(diary.router)
app.include_router(recognize.router)
app.include_router(search.router)
app.include_router(weights.router)
app.include_router(recipes.router)
app.include_router(ai.router)


@app.get("/api/health")
def health():
    return {"ok": True}
