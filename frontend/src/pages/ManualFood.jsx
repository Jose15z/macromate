import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import { useT } from "../i18n";
import { MEAL_TYPES, logTarget } from "../utils";

export default function ManualFood() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { date, meal: initialMeal } = logTarget(searchParams);
  const prefillBarcode = searchParams.get("barcode") || "";

  const [meal, setMeal] = useState(initialMeal);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [basis, setBasis] = useState("per_serving");
  const [servingSize, setServingSize] = useState(100);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [logNow, setLogNow] = useState(true);
  const [grams, setGrams] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      barcode: prefillBarcode || null,
      basis,
      serving_size_g: Number(servingSize) || null,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: fiber === "" ? null : Number(fiber),
      sugar: sugar === "" ? null : Number(sugar),
      sodium: sodium === "" ? null : Number(sodium),
    };
    if (basis === "per_serving" && !payload.serving_size_g) {
      setError(t("manual.servingRequired"));
      return;
    }

    setBusy(true);
    try {
      const food = await api.createFood(payload);
      if (logNow) {
        const amount = Number(grams) || payload.serving_size_g || 100;
        await api.addEntry({
          date,
          meal_type: meal,
          grams: amount,
          food_id: food.id,
        });
        navigate(`/?date=${date}`);
      } else {
        navigate(`/add?date=${date}&meal=${meal}`);
      }
    } catch (err) {
      setError(err.message || t("manual.saveError"));
      setBusy(false);
    }
  }

  return (
    <div className="manual-page">
      <h2>{t("manual.title")}</h2>
      <p className="muted small">{t("manual.intro")}</p>

      <form className="card form" onSubmit={handleSubmit}>
        <label>
          {t("manual.name")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder={t("manual.namePlaceholder")}
          />
        </label>
        <label>
          {t("manual.brand")} <span className="muted small">{t("manual.optional")}</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={200} />
        </label>
        {prefillBarcode && (
          <p className="muted small">{t("manual.barcodeLink", { code: prefillBarcode })}</p>
        )}

        <label>
          {t("manual.basis")}
          <div className="chip-row">
            <button
              type="button"
              className={`chip${basis === "per_serving" ? " active" : ""}`}
              onClick={() => setBasis("per_serving")}
            >
              {t("manual.perServing")}
            </button>
            <button
              type="button"
              className={`chip${basis === "per_100g" ? " active" : ""}`}
              onClick={() => setBasis("per_100g")}
            >
              {t("manual.per100")}
            </button>
          </div>
        </label>

        <label>
          {t("manual.servingSize")}
          {basis === "per_100g" && (
            <span className="muted small"> {t("manual.optional")}</span>
          )}
          <input
            type="number"
            min="1"
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            required={basis === "per_serving"}
          />
        </label>

        <div className="grid-2">
          <label>
            {t("manual.calories")}
            <input type="number" min="0" step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
          </label>
          <label>
            {t("dash.protein")} (g)
            <input type="number" min="0" step="any" value={protein} onChange={(e) => setProtein(e.target.value)} required />
          </label>
          <label>
            {t("dash.carbs")} (g)
            <input type="number" min="0" step="any" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
          </label>
          <label>
            {t("dash.fat")} (g)
            <input type="number" min="0" step="any" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </label>
        </div>

        <button
          type="button"
          className="btn ghost"
          style={{ alignSelf: "start" }}
          onClick={() => setShowMore((v) => !v)}
        >
          {t("manual.more")}
        </button>
        {showMore && (
          <div className="grid-2">
            <label>
              {t("product.fiber")} (g)
              <input type="number" min="0" step="any" value={fiber} onChange={(e) => setFiber(e.target.value)} />
            </label>
            <label>
              {t("product.sugar")} (g)
              <input type="number" min="0" step="any" value={sugar} onChange={(e) => setSugar(e.target.value)} />
            </label>
            <label>
              {t("product.sodium")} (g)
              <input type="number" min="0" step="any" value={sodium} onChange={(e) => setSodium(e.target.value)} />
            </label>
          </div>
        )}

        <label className="checkbox">
          <input type="checkbox" checked={logNow} onChange={(e) => setLogNow(e.target.checked)} />
          {t("manual.logNow")}
        </label>

        {logNow && (
          <>
            <label>
              {t("product.meal")}
              <div className="chip-row">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chip${m === meal ? " active" : ""}`}
                    onClick={() => setMeal(m)}
                  >
                    {t(`meals.${m}`)}
                  </button>
                ))}
              </div>
            </label>
            <label>
              {t("manual.amountToLog")}
              <input
                type="number"
                min="1"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder={t("manual.defaultAmount", { n: servingSize || 100 })}
              />
            </label>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)} disabled={busy}>
            {t("common.back")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("common.saving") : logNow ? t("manual.saveLog") : t("manual.saveOnly")}
          </button>
        </div>
      </form>
    </div>
  );
}
