import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import FoodListItem from "../components/FoodListItem";
import Icon from "../components/Icon";
import Loading from "../components/Loading";
import { useT } from "../i18n";
import { MEAL_TYPES, logTarget } from "../utils";

const TABS = ["recent", "saved", "frequent", "scanned", "recipes"];

function QuantityDialog({ food, onConfirm, onCancel }) {
  const { t } = useT();
  const [grams, setGrams] = useState(Math.round(food.serving_size_g || 100));
  const [busy, setBusy] = useState(false);
  const scale = (Number(grams) || 0) / 100;

  async function confirm() {
    if (!Number(grams) || Number(grams) <= 0) return;
    setBusy(true);
    try {
      await onConfirm(food, Number(grams));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <h3>{food.name}</h3>
        {food.brand && <p className="muted small">{food.brand}</p>}
        <label>
          {t("qty.amount")}
          <input
            type="number"
            min="1"
            value={grams}
            autoFocus
            onChange={(e) => setGrams(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />
        </label>
        {food.serving_size_g && (
          <div className="chip-row">
            {[0.5, 1, 2].map((mult) => (
              <button
                key={mult}
                className="chip"
                onClick={() => setGrams(Math.round(food.serving_size_g * mult))}
              >
                {mult} × {t("qty.serving")} ({Math.round(food.serving_size_g * mult)} g)
              </button>
            ))}
          </div>
        )}
        <div className="macro-preview">
          <span>{Math.round(food.kcal_100g * scale)} kcal</span>
          <span>P {(food.protein_100g * scale).toFixed(1)} g</span>
          <span>C {(food.carbs_100g * scale).toFixed(1)} g</span>
          <span>F {(food.fat_100g * scale).toFixed(1)} g</span>
        </div>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" onClick={confirm} disabled={busy}>
            {busy ? t("qty.adding") : t("qty.addToDiary")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeLogDialog({ recipe, onConfirm, onCancel }) {
  const { t } = useT();
  const [factor, setFactor] = useState(1);
  const [busy, setBusy] = useState(false);
  const f = Number(factor) || 0;

  async function confirm() {
    if (f <= 0) return;
    setBusy(true);
    try {
      await onConfirm(recipe, f);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <h3>{recipe.name}</h3>
        <p className="muted small">{t("recipes.items", { n: recipe.items.length })}</p>
        <label>
          {t("recipe.portions")}
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={factor}
            autoFocus
            onChange={(e) => setFactor(e.target.value)}
          />
        </label>
        <div className="chip-row">
          {[0.5, 1, 2].map((m) => (
            <button key={m} className="chip" onClick={() => setFactor(m)}>
              {m}×
            </button>
          ))}
        </div>
        <div className="macro-preview">
          <span>{Math.round(recipe.totals.kcal * f)} kcal</span>
          <span>P {(recipe.totals.protein * f).toFixed(1)} g</span>
          <span>C {(recipe.totals.carbs * f).toFixed(1)} g</span>
          <span>F {(recipe.totals.fat * f).toFixed(1)} g</span>
        </div>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" onClick={confirm} disabled={busy}>
            {busy ? t("qty.adding") : t("recipe.logN", { n: recipe.items.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddFood() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { date, meal } = logTarget(searchParams);

  const [tab, setTab] = useState("recent");
  const [search, setSearch] = useState("");
  const [foods, setFoods] = useState(null);
  const [recipes, setRecipes] = useState(null);
  const [offResults, setOffResults] = useState(null);
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState("");
  const [offRetry, setOffRetry] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // own library / recipes
  useEffect(() => {
    let alive = true;
    setError("");
    if (tab === "recipes") {
      setRecipes(null);
      api
        .listRecipes()
        .then((data) => alive && setRecipes(data.recipes))
        .catch((err) => alive && setError(err.message || t("add.loadError")));
      return () => {
        alive = false;
      };
    }
    setFoods(null);
    const timer = setTimeout(() => {
      api
        .listFoods(tab, search.trim())
        .then((data) => alive && setFoods(data.foods))
        .catch((err) => alive && setError(err.message || t("add.loadError")));
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [tab, search, t]);

  // OpenFoodFacts text search (debounced, min 3 chars)
  useEffect(() => {
    const q = search.trim();
    if (tab === "recipes" || q.length < 3) {
      setOffResults(null);
      setOffLoading(false);
      setOffError("");
      return;
    }
    let alive = true;
    setOffLoading(true);
    setOffError("");
    const timer = setTimeout(() => {
      api
        .searchProducts(q)
        .then((data) => {
          if (!alive) return;
          setOffResults(data.products);
        })
        .catch((err) => {
          if (!alive) return;
          setOffResults(null);
          setOffError(err.message);
        })
        .finally(() => alive && setOffLoading(false));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, tab, offRetry]);

  function setMeal(newMeal) {
    setSearchParams({ date, meal: newMeal });
  }

  async function handleConfirmOwn(food, grams) {
    await api.addEntry({ date, meal_type: meal, grams, food_id: food.id });
    navigate(`/?date=${date}`);
  }

  async function handleConfirmOff(product, grams) {
    await api.addEntry({
      date,
      meal_type: meal,
      grams,
      food: {
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        image_url: product.image,
        source: "off",
        kcal_100g: product.kcal_100g,
        protein_100g: product.protein_100g,
        carbs_100g: product.carbs_100g,
        fat_100g: product.fat_100g,
        fiber_100g: product.fiber_100g,
        sugar_100g: product.sugar_100g,
        sodium_100g: product.sodium_100g,
        serving_size_g: product.serving_size_g,
      },
    });
    navigate(`/?date=${date}`);
  }

  async function handleLogRecipe(recipe, factor) {
    await api.logRecipe(recipe.id, date, meal, factor);
    navigate(`/?date=${date}`);
  }

  async function handleDeleteFood(food) {
    if (!window.confirm(t("add.deleteFood", { name: food.name }))) return;
    await api.deleteFood(food.id);
    setFoods((prev) => prev.filter((f) => f.id !== food.id));
  }

  const query = `date=${date}&meal=${meal}`;
  const showOff = tab !== "recipes" && search.trim().length >= 3;

  return (
    <div className="add-food">
      <h2>{t("add.title")}</h2>

      <div className="meal-select chip-row">
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            className={`chip${m === meal ? " active" : ""}`}
            onClick={() => setMeal(m)}
          >
            {t(`meals.${m}`)}
          </button>
        ))}
      </div>

      <div className="quick-actions">
        <button className="btn" onClick={() => navigate(`/scan?${query}`)}>
          <Icon name="scan" />
          {t("dash.scan")}
        </button>
        <button className="btn" onClick={() => navigate(`/photo?${query}`)}>
          <Icon name="camera" />
          {t("dash.photo")}
        </button>
        <button className="btn" onClick={() => navigate(`/manual?${query}`)}>
          <Icon name="pencil" />
          {t("dash.manual")}
        </button>
      </div>

      <input
        className="search-input"
        placeholder={t("add.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="tabs">
        {TABS.map((key) => (
          <button
            key={key}
            className={`tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {t(`add.${key}`)}
          </button>
        ))}
      </div>

      {error && <div className="error card">{error}</div>}

      {tab === "recipes" ? (
        <>
          {!recipes && !error && <Loading />}
          {recipes && recipes.length === 0 && (
            <div className="empty card">
              <p className="muted small">{t("add.noRecipes")}</p>
            </div>
          )}
          {recipes && recipes.length > 0 && (
            <div className="food-list card">
              {recipes.map((r) => (
                <div key={r.id} className="food-item" onClick={() => setSelectedRecipe(r)}>
                  <div className="food-item-main">
                    <div className="food-item-name">{r.name}</div>
                    <div className="food-item-sub num">
                      {t("recipes.items", { n: r.items.length })} ·{" "}
                      {Math.round(r.totals.kcal)} kcal {t("recipes.perRecipe")}
                    </div>
                  </div>
                  <Icon name="chevronRight" />
                </div>
              ))}
            </div>
          )}
          <Link to="/recipes" className="btn ghost" style={{ alignSelf: "start" }}>
            {t("add.manageRecipes")}
          </Link>
        </>
      ) : (
        <>
          {!foods && !error && <Loading />}
          {foods && foods.length === 0 && !showOff && (
            <div className="empty card">
              <p>{t("add.empty")}</p>
              <p className="muted small">
                {t(tab === "scanned" ? "add.emptyHintScan" : "add.emptyHintLog")}
              </p>
            </div>
          )}
          {foods && foods.length > 0 && (
            <div className="food-list card">
              {foods.map((food) => (
                <FoodListItem
                  key={food.id}
                  food={food}
                  onSelect={setSelected}
                  onDelete={tab === "saved" ? handleDeleteFood : undefined}
                />
              ))}
            </div>
          )}

          {showOff && (
            <>
              <h3 className="section-label">{t("add.offResults")}</h3>
              {offLoading && <Loading label={t("add.offSearching")} />}
              {!offLoading && offError && (
                <p className="error small">
                  {offError}{" "}
                  <button className="btn tiny" onClick={() => setOffRetry((n) => n + 1)}>
                    {t("common.retry")}
                  </button>
                </p>
              )}
              {!offLoading && !offError && offResults && offResults.length === 0 && (
                <p className="muted small">{t("add.offNone", { q: search.trim() })}</p>
              )}
              {!offLoading && offResults && offResults.length > 0 && (
                <div className="food-list card">
                  {offResults.map((p) => (
                    <FoodListItem
                      key={p.barcode}
                      food={{
                        ...p,
                        id: p.barcode,
                        image_url: p.image,
                      }}
                      onSelect={() => setSelected({ ...p, _off: true })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <QuantityDialog
          food={selected}
          onConfirm={selected._off ? handleConfirmOff : handleConfirmOwn}
          onCancel={() => setSelected(null)}
        />
      )}
      {selectedRecipe && (
        <RecipeLogDialog
          recipe={selectedRecipe}
          onConfirm={handleLogRecipe}
          onCancel={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
}
