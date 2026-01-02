import { useEffect, useState } from "react";
import { fetchProduct, addToDay } from "../api";
import MacroCard from "../components/Macrocard";


export default function Product({ barcode, onDone }) {
  const [p, setP] = useState(null);
  const [grams, setGrams] = useState(100);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchProduct(barcode)
      .then((data) => alive && setP(data))
      .catch((e) => alive && setErr("Product not found or API error"))
      .finally(() => alive && setLoading(false));
    return () => (alive = false);
  }, [barcode]);

  if (loading) return <div>Loading product…</div>;
  if (err) return <div>{err}</div>;
  if (!p) return null;

  const scale = grams / 100;
  const kcal = (p.kcal_100g * scale).toFixed(1);
  const protein = (p.protein_100g * scale).toFixed(1);
  const carbs = (p.carbs_100g * scale).toFixed(1);
  const fat = (p.fat_100g * scale).toFixed(1);

  async function handleAdd() {
    setSaving(true);
    try {
      await addToDay({
        barcode: p.barcode,
        product_name: p.name,
        grams: Number(grams),
        kcal_100g: p.kcal_100g,
        protein_100g: p.protein_100g,
        carbs_100g: p.carbs_100g,
        fat_100g: p.fat_100g,
      });
      onDone();
    } catch {
      setErr("Failed to save consumption");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>{p.name}</h3>
      <div style={{ opacity: 0.75, marginBottom: 10 }}>{p.brand}</div>
      {p.image ? <img src={p.image} alt="" style={{ width: 140, borderRadius: 10 }} /> : null}

      <div style={{ marginTop: 14 }}>
        <label>Grams:</label>{" "}
        <input
          type="number"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          style={{ width: 120, padding: 6, marginLeft: 8 }}
          min={1}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <MacroCard label="Kcal" value={kcal} />
        <MacroCard label="Protein (g)" value={protein} />
        <MacroCard label="Carbs (g)" value={carbs} />
        <MacroCard label="Fat (g)" value={fat} />
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleAdd} disabled={saving}>
          {saving ? "Saving…" : "Add to Today"}
        </button>
      </div>
    </div>
  );
}
