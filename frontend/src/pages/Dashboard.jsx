import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import { useAuth } from "../AuthContext";
import CalorieRing from "../components/CalorieRing";
import Icon from "../components/Icon";
import Loading from "../components/Loading";
import MacroProgress from "../components/MacroProgress";
import MealSection from "../components/MealSection";
import { useT } from "../i18n";
import { formatDate, shiftDate, todayISO } from "../utils";

function guessMealByHour() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

function SuggestDialog({ date, onClose }) {
  const { t, lang } = useT();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .suggestMeals(date, guessMealByHour(), lang)
      .then((data) => alive && setResult(data))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [date, lang]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <h3>{t("suggest.title")}</h3>
        <p className="muted small">{t("suggest.subtitle")}</p>

        {error && <div className="error">{error}</div>}
        {!result && !error && <Loading label={t("suggest.loading")} />}
        {result && result.message && <p className="muted small">{result.message}</p>}
        {result &&
          result.suggestions.map((s, i) => (
            <div key={i} className="suggestion">
              <div className="suggestion-name">{s.name}</div>
              <p className="muted small">{s.description}</p>
              <div className="muted small num">
                ≈{Math.round(s.kcal)} kcal · P {Math.round(s.protein_g)} · C{" "}
                {Math.round(s.carbs_g)} · F {Math.round(s.fat_g)}
              </div>
            </div>
          ))}

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") || todayISO();

  const [day, setDay] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(() => {
    setError("");
    api
      .fetchDay(date)
      .then(setDay)
      .catch((err) => setError(err.message || t("dash.loadError")));
  }, [date, t]);

  useEffect(() => {
    setDay(null);
    setNotice("");
    load();
  }, [load]);

  function goTo(newDate) {
    setSearchParams(newDate === todayISO() ? {} : { date: newDate });
  }

  function handleAdd(mealType) {
    navigate(`/add?date=${date}&meal=${mealType}`);
  }

  async function handleUpdateGrams(entry, grams) {
    await api.updateEntry(entry.id, { grams });
    load();
  }

  async function handleDelete(entry) {
    const msg = t("meal.removeConfirm", {
      name: entry.name,
      meal: t(`meals.${entry.meal_type}`).toLowerCase(),
    });
    if (!window.confirm(msg)) return;
    await api.deleteEntry(entry.id);
    load();
  }

  async function handleCopyYesterday(mealType) {
    setNotice("");
    const { copied } = await api.copyDay(shiftDate(date, -1), date, mealType);
    if (copied === 0) setNotice(t("meal.nothingYesterday"));
    else load();
  }

  return (
    <div className="dashboard">
      <div className="date-nav">
        <button
          className="icon-btn"
          onClick={() => goTo(shiftDate(date, -1))}
          title={t("dash.prevDay")}
        >
          <Icon name="chevronLeft" />
        </button>
        <div className="date-nav-center">
          <span className="date-label">{formatDate(date)}</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => e.target.value && goTo(e.target.value)}
          />
        </div>
        <button
          className="icon-btn"
          onClick={() => goTo(shiftDate(date, 1))}
          disabled={date >= todayISO()}
          title={t("dash.nextDay")}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      {error && (
        <div className="error card">
          {error}{" "}
          <button className="btn tiny" onClick={load}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!day && !error && <Loading label={t("dash.loading")} />}

      {day && (
        <>
          <section className="card progress-card">
            <h2 className="progress-title">
              {profile?.display_name
                ? t("dash.usersDay", { name: profile.display_name })
                : t("dash.yourDay")}
            </h2>
            <div className="progress-layout">
              <CalorieRing consumed={day.totals.kcal} goal={day.goals.kcal} />
              <div className="macro-bars">
                <MacroProgress
                  label={t("dash.protein")}
                  consumed={day.totals.protein}
                  goal={day.goals.protein}
                  unit="g"
                  color="var(--c-protein)"
                />
                <MacroProgress
                  label={t("dash.carbs")}
                  consumed={day.totals.carbs}
                  goal={day.goals.carbs}
                  unit="g"
                  color="var(--c-carbs)"
                />
                <MacroProgress
                  label={t("dash.fat")}
                  consumed={day.totals.fat}
                  goal={day.goals.fat}
                  unit="g"
                  color="var(--c-fat)"
                />
              </div>
            </div>
          </section>

          <div className="quick-actions">
            <button className="btn" onClick={() => navigate(`/scan?date=${date}&meal=breakfast`)}>
              <Icon name="scan" />
              {t("dash.scan")}
            </button>
            <button className="btn" onClick={() => navigate(`/photo?date=${date}&meal=breakfast`)}>
              <Icon name="camera" />
              {t("dash.photo")}
            </button>
            <button className="btn" onClick={() => navigate(`/manual?date=${date}&meal=breakfast`)}>
              <Icon name="pencil" />
              {t("dash.manual")}
            </button>
          </div>

          <button className="btn suggest-btn" onClick={() => setSuggesting(true)}>
            <Icon name="sparkles" />
            {t("dash.suggest")}
          </button>

          {notice && <div className="card muted small">{notice}</div>}

          {day.meals.map((meal) => (
            <MealSection
              key={meal.meal_type}
              meal={meal}
              onAdd={handleAdd}
              onUpdateGrams={handleUpdateGrams}
              onDelete={handleDelete}
              onCopyYesterday={handleCopyYesterday}
            />
          ))}
        </>
      )}

      {suggesting && <SuggestDialog date={date} onClose={() => setSuggesting(false)} />}
    </div>
  );
}
