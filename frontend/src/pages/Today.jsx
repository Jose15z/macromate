import { useEffect, useState } from "react";
import { fetchDay } from "../api";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export default function Today() {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    fetchDay(day)
      .then(setData)
      .catch(() => setErr("Could not load day"));
  }, [day]);

  return (
    <div>
      <h3>Today</h3>
      <div style={{ marginBottom: 12 }}>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>

      {err ? <div>{err}</div> : null}
      {!data ? <div>Loading…</div> : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div><b>Kcal:</b> {data.totals.kcal}</div>
            <div><b>P:</b> {data.totals.protein}g</div>
            <div><b>C:</b> {data.totals.carbs}g</div>
            <div><b>F:</b> {data.totals.fat}g</div>
          </div>

          <h4>Items</h4>
          {data.items.length === 0 ? <div>No items yet.</div> : (
            <div style={{ display: "grid", gap: 10 }}>
              {data.items.map((it, idx) => (
                <div key={idx} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                  <div style={{ opacity: 0.75 }}>{it.grams}g — {it.kcal.toFixed(1)} kcal</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    P {it.protein.toFixed(1)}g • C {it.carbs.toFixed(1)}g • F {it.fat.toFixed(1)}g
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
