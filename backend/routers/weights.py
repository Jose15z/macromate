from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import get_conn
from schemas import DATE_PATTERN, WeightUpsert

router = APIRouter(prefix="/api", tags=["weights"])


@router.post("/weights")
def upsert_weight(payload: WeightUpsert, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO weights (user_id, date, weight_kg) VALUES (?, ?, ?)
            ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg
            """,
            (user["id"], payload.date, payload.weight_kg),
        )
        conn.commit()
        return {"date": payload.date, "weight_kg": payload.weight_kg}
    finally:
        conn.close()


@router.get("/weights")
def list_weights(
    user: dict = Depends(get_current_user),
    start: str = Query(pattern=DATE_PATTERN),
    end: str = Query(pattern=DATE_PATTERN),
):
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT date, weight_kg FROM weights
            WHERE user_id = ? AND date BETWEEN ? AND ?
            ORDER BY date
            """,
            (user["id"], start, end),
        ).fetchall()
        return {"weights": [{"date": r["date"], "weight_kg": r["weight_kg"]} for r in rows]}
    finally:
        conn.close()


@router.delete("/weights/{date}")
def delete_weight(
    date: str,
    user: dict = Depends(get_current_user),
):
    conn = get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM weights WHERE user_id = ? AND date = ?", (user["id"], date)
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="No weight logged on that date")
        return {"ok": True}
    finally:
        conn.close()
