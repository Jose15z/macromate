import { useEffect, useMemo, useState } from "react";
import { fetchProduct, addToDay } from "../api";

function MacroCard({ label, value, sub }) {
  return (
    <div className="macroCard">
      <p className="macroLabel">{label}</p>
      <p className="macroValue">{value}</p>
      {sub ? <div className="macroSub">{sub}</div> : null}
    </div>
  );
}

export default function Product({ barcode, onDone, onBack }) {
  const [product, setProduct] = useState(null);
  const [grams, setGrams] = useState(100);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsg(null);

    fetchProduct(barcode)
      .then((data) => {
        if (!alive) return;
        setProduct(data);
      })
      .catch((e) => {
        if (!alive) return;
        setProduct(null);
        setMsg({ type: "err", text: e?.message || "Failed to fetch product." });
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [barcode]);

  const factor = useMemo(() => {
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return 1;
    return g / 100;
  }, [grams]);

  if (loading) {
    return (
      <div className="card">
        <h2 className="hTitle">Loading product…</h2>
        <p className="pMuted">Fetching macros for barcode: {barcode}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card">
        <h2 className="hTitle">Product not found</h2>
        <p className="pMuted">Barcode: {barcode}</p>
        {msg ? <div className={"toast " + (msg.type === "err" ? "toastErr" : "")}>{msg.text}</div> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  // Ajusta estos campos si tu backend devuelve otros nombres:
  const name = product.name || product.product_name || "Unknown product";
  const brand = product.brand || product.brands || "";
  const image = product.image || product.image_url || null;

  const kcal100 = Number(product.kcal_100g ?? product.energy_kcal_100g ?? 0);
  const p100 = Number(product.protein_100g ?? 0);
  const c100 = Number(product.carbs_100g ?? product.carbohydrates_100g ?? 0);
  const f100 = Number(product.fat_100g ?? 0);

  const kcal = (kcal100 * factor).toFixed(1);
  const protein = (p100 * factor).toFixed(1);
  const carbs = (c100 * factor).toFixed(1);
  const fat = (f100 * factor).toFixed(1);

  async function handleAdd() {
    try {
      setMsg(null);
      await addToDay({
        barcode,
        product_name: name,
        grams: Number(grams),
        kcal_100g: kcal100,
        protein_100g: p100,
        carbs_100g: c100,
        fat_100g: f100,
      });
      setMsg({ type: "ok", text: "Added to Today ✅" });
      setTimeout(() => onDone?.(), 250);
    } catch (e) {
      setMsg({ type: "err", text: e?.message || "Failed to add to Today." });
    }
  }

  return (
    <div className="card">
      <div className="productHeader">
        <div className="productMeta">
          {image ? <img className="productImg" src={image} alt="" /> : <div className="productImg" />}
          <div>
            <h3 className="productName">{name}</h3>
            <p className="productBrand">{brand || "—"}</p>
            <div className="badge" style={{ marginTop: 10 }}>
              Barcode: <b style={{ color: "white" }}>{barcode}</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="divider" />

      <div className="grid2">
        <div>
          <h2 className="hTitle" style={{ marginBottom: 6 }}>Macros</h2>
          <p className="pMuted">Calculated for your serving size.</p>

          <div className="macroGrid" style={{ marginTop: 14 }}>
            <MacroCard label="Calories" value={kcal} sub="kcal" />
            <MacroCard label="Protein" value={protein} sub="g" />
            <MacroCard label="Carbs" value={carbs} sub="g" />
            <MacroCard label="Fat" value={fat} sub="g" />
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Serving</h3>
          <p className="pMuted">Adjust grams to recalculate macros.</p>

          <div className="fieldRow" style={{ marginTop: 12 }}>
            <input
              className="input"
              type="number"
              min={1}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
            <button className="btn btnPrimary" onClick={handleAdd}>
              Add to Today
            </button>
          </div>

          {msg ? (
            <div className={"toast " + (msg.type === "err" ? "toastErr" : "toastOk")}>
              {msg.text}
            </div>
          ) : null}

          <div className="footerNote">
            Values are computed from per-100g nutrition. If the API lacks macros, values may be zero.
          </div>
        </div>
      </div>
    </div>
  );
}
