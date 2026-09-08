import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import { useAuth } from "../AuthContext";
import CalorieRing from "../components/CalorieRing";
import Loading from "../components/Loading";
import MacroProgress from "../components/MacroProgress";
import MealSection from "../components/MealSection";
import { formatDate, shiftDate, todayISO } from "../utils";

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") || todayISO();

  const [day, setDay] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api
      .fetchDay(date)
      .then(setDay)
      .catch((err) => setError(err.message || "Could not load this day"));
  }, [date]);

  useEffect(() => {
    setDay(null);
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
    if (!window.confirm(`Remove ${entry.name} from ${entry.meal_type}?`)) return;
    await api.deleteEntry(entry.id);
    load();
  }

  return (
    <div className="dashboard">
      <div className="date-nav">
        <button className="icon-btn" onClick={() => goTo(shiftDate(date, -1))} title="Previous day">
          ‹
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
          title="Next day"
        >
          ›
        </button>
      </div>

      {error && (
        <div className="error card">
          {error} <button className="btn tiny" onClick={load}>Retry</button>
        </div>
      )}

      {!day && !error && <Loading label="Loading your diary…" />}

      {day && (
        <>
          <section className="card progress-card">
            <h2 className="progress-title">
              {profile?.display_name ? `${profile.display_name}'s day` : "Your day"}
            </h2>
            <div className="progress-layout">
              <CalorieRing consumed={day.totals.kcal} goal={day.goals.kcal} />
              <div className="macro-bars">
                <MacroProgress
                  label="Protein"
                  consumed={day.totals.protein}
                  goal={day.goals.protein}
                  unit="g"
                  color="var(--c-protein)"
                />
                <MacroProgress
                  label="Carbohydrates"
                  consumed={day.totals.carbs}
                  goal={day.goals.carbs}
                  unit="g"
                  color="var(--c-carbs)"
                />
                <MacroProgress
                  label="Fat"
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
              📷 Scan barcode
            </button>
            <button className="btn" onClick={() => navigate(`/photo?date=${date}&meal=breakfast`)}>
              🍛 Photo of meal
            </button>
            <button className="btn" onClick={() => navigate(`/manual?date=${date}&meal=breakfast`)}>
              ✏️ Manual entry
            </button>
          </div>

          {day.meals.map((meal) => (
            <MealSection
              key={meal.meal_type}
              meal={meal}
              onAdd={handleAdd}
              onUpdateGrams={handleUpdateGrams}
              onDelete={handleDelete}
            />
          ))}
        </>
      )}
    </div>
  );
}
