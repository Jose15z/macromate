import { useEffect, useMemo, useState } from "react";
import { fetchDay } from "../api";

function MacroCard({ label, value, sub }) {
  return (
    <div className="macroCard">
      <p className="macroLabel">{label}</p>
      <p className="macroValue">{value}</p>
      {sub ? <div className="macroSub">{sub}</div> : null}
    </div>
  );
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Today({ onBack }) {
  const [day, setDay] = useState(todayStr());
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setErr(null);

    fetchDay(day)
      .then((res) => alive && setData(res))
      .catch((e) => alive && setErr(e?.message || "Failed to load day"))
      .finally(() => {});

    return () => { alive = false; };
  }, [day]);

  const totals = useMemo(() => {
    // Ajusta según tu backend: items podría llamarse entries/log/etc.
    const items = data?.items || data?.entries || [];
    const sum = (k) => items.reduce((acc, it) => acc + Number(it[k] || 0), 0);
    return {
      kcal: sum("kcal"),
      protein: sum("protein_g"),
      carbs: sum("carbs_g"),
      fat: sum("fat_g"),
      count: items.length,
      items,
    };
  }, [data]);

  return (
    <div className="card">
      <div className="productHeader">
        <div>
          <h2 className="hTitle" style={{ marginBottom: 6 }}>Today</h2>
          <p className="pMuted">Daily summary and logged items.</p>
        </div>
        <button className="btn" onClick={onBack}>Back</button>
      </div>

      <div className="divider" />

      <div className="fieldRow" style={{ marginTop: 0 }}>
        <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <span className="badge">{totals.count} items</span>
      </div>

      {err ? <div className="toast toastErr">{err}</div> : null}

      <div className="macroGrid" style={{ marginTop: 14 }}>
        <MacroCard label="Calories" value={totals.kcal.toFixed(0)} sub="kcal" />
        <MacroCard label="Protein" value={totals.protein.toFixed(1)} sub="g" />
        <MacroCard label="Carbs" value={totals.carbs.toFixed(1)} sub="g" />
        <MacroCard label="Fat" value={totals.fat.toFixed(1)} sub="g" />
      </div>

      <div className="divider" />

      <h3 style={{ marginTop: 0 }}>Log</h3>
      <p className="pMuted" style={{ marginBottom: 12 }}>
        Items you’ve added today.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {totals.items.map((it, idx) => (
          <div key={idx} className="macroCard">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{it.product_name || it.name || "Item"}</div>
                <div className="macroSub">{it.grams ?? "?"} g</div>
              </div>
              <div className="badge">
                {Number(it.kcal || 0).toFixed(0)} kcal
              </div>
            </div>
          </div>
        ))}
        {totals.items.length === 0 ? (
          <div className="toast">No items yet. Add a product from Search.</div>
        ) : null}
      </div>
    </div>
  );
}
