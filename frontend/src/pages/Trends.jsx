import { useEffect, useMemo, useState } from "react";
import * as api from "../api";
import { useAuth } from "../AuthContext";
import Loading from "../components/Loading";
import MacroProgress from "../components/MacroProgress";
import { useT } from "../i18n";
import { shiftDate, shortDate, todayISO } from "../utils";

const RANGE_DAYS = 30;

function rangeDates(days) {
  const end = todayISO();
  const out = [];
  for (let i = days - 1; i >= 0; i--) out.push(shiftDate(end, -i));
  return out;
}

function computeStreak(loggedDates) {
  const set = new Set(loggedDates);
  let day = todayISO();
  if (!set.has(day)) day = shiftDate(day, -1); // today not logged yet doesn't break it
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = shiftDate(day, -1);
  }
  return streak;
}

function KcalBarChart({ dates, byDate, goal }) {
  const { t } = useT();
  const W = 640;
  const H = 180;
  const PAD = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxY = Math.max(goal * 1.15, ...dates.map((d) => byDate[d]?.kcal || 0), 1);
  const slot = innerW / dates.length;
  const barW = Math.min(slot * 0.62, 26);
  const y = (v) => PAD.top + innerH * (1 - v / maxY);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {/* goal line */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={y(goal)}
        y2={y(goal)}
        stroke="var(--muted)"
        strokeDasharray="4 4"
        strokeWidth="1"
        opacity="0.6"
      />
      <text x={W - PAD.right} y={y(goal) - 4} textAnchor="end" className="chart-label">
        {t("trends.goal")} {Math.round(goal).toLocaleString()}
      </text>

      {dates.map((d, i) => {
        const v = byDate[d]?.kcal || 0;
        const x = PAD.left + slot * i + (slot - barW) / 2;
        const h = v > 0 ? Math.max(2, innerH * (v / maxY)) : 0;
        const over = goal > 0 && v > goal;
        return (
          <g key={d}>
            {v > 0 && (
              <rect
                x={x}
                y={PAD.top + innerH - h}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill={over ? "var(--warn)" : "var(--accent)"}
              >
                <title>{`${shortDate(d)} — ${Math.round(v).toLocaleString()} kcal`}</title>
              </rect>
            )}
            {v === 0 && (
              <rect
                x={x}
                y={PAD.top + innerH - 2}
                width={barW}
                height={2}
                fill="var(--border-strong)"
              />
            )}
          </g>
        );
      })}

      <text x={PAD.left} y={H - 6} className="chart-label">
        {shortDate(dates[0])}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" className="chart-label">
        {shortDate(dates[dates.length - 1])}
      </text>
    </svg>
  );
}

function WeightChart({ weights }) {
  const W = 640;
  const H = 160;
  const PAD = { top: 16, right: 42, bottom: 22, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = weights.map((w) => w.weight_kg);
  const min = Math.min(...values) - 0.8;
  const max = Math.max(...values) + 0.8;
  const t0 = new Date(weights[0].date).getTime();
  const t1 = new Date(weights[weights.length - 1].date).getTime();
  const span = Math.max(t1 - t0, 1);

  const x = (w) => PAD.left + innerW * ((new Date(w.date).getTime() - t0) / span);
  const y = (v) => PAD.top + innerH * (1 - (v - min) / (max - min));

  const path = weights
    .map((w, i) => `${i === 0 ? "M" : "L"}${x(w).toFixed(1)} ${y(w.weight_kg).toFixed(1)}`)
    .join(" ");
  const last = weights[weights.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {weights.length > 1 && (
        <path d={path} fill="none" stroke="var(--c-protein)" strokeWidth="2" />
      )}
      {weights.map((w) => (
        <circle key={w.date} cx={x(w)} cy={y(w.weight_kg)} r="3.5" fill="var(--c-protein)">
          <title>{`${shortDate(w.date)} — ${w.weight_kg} kg`}</title>
        </circle>
      ))}
      <text x={x(last) + 8} y={y(last.weight_kg) + 3} className="chart-label strong">
        {last.weight_kg} kg
      </text>
      <text x={PAD.left} y={H - 6} className="chart-label">
        {shortDate(weights[0].date)}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" className="chart-label">
        {shortDate(last.date)}
      </text>
    </svg>
  );
}

export default function Trends() {
  const { profile } = useAuth();
  const { t } = useT();
  const [rangeLen, setRangeLen] = useState(7);
  const [days, setDays] = useState(null);
  const [weights, setWeights] = useState(null);
  const [error, setError] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const allDates = useMemo(() => rangeDates(RANGE_DAYS), []);

  function load() {
    setError("");
    const start = allDates[0];
    const end = allDates[allDates.length - 1];
    Promise.all([api.fetchSummary(start, end), api.listWeights(start, end)])
      .then(([summary, w]) => {
        setDays(summary.days);
        setWeights(w.weights);
      })
      .catch((err) => setError(err.message || t("trends.loadError")));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveWeight(e) {
    e.preventDefault();
    const v = Number(weightInput);
    if (!v || v <= 0) return;
    setSavingWeight(true);
    try {
      await api.upsertWeight(todayISO(), v);
      setWeightInput("");
      load();
    } finally {
      setSavingWeight(false);
    }
  }

  if (error)
    return (
      <div className="error card">
        {error}{" "}
        <button className="btn tiny" onClick={load}>
          {t("common.retry")}
        </button>
      </div>
    );
  if (!days || !weights) return <Loading />;

  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const viewDates = allDates.slice(-rangeLen);
  const loggedInView = viewDates.filter((d) => byDate[d]);
  const streak = computeStreak(days.map((d) => d.date));

  const avg = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const d of loggedInView) {
    for (const m of Object.keys(avg)) avg[m] += byDate[d][m];
  }
  for (const m of Object.keys(avg)) {
    avg[m] = loggedInView.length ? avg[m] / loggedInView.length : 0;
  }

  const goals = {
    kcal: profile?.kcal_goal ?? 2000,
    protein: profile?.protein_goal ?? 150,
    carbs: profile?.carbs_goal ?? 250,
    fat: profile?.fat_goal ?? 70,
  };

  return (
    <div className="trends-page">
      <div className="trends-head">
        <h2>{t("trends.title")}</h2>
        <div className="chip-row">
          {[7, 30].map((n) => (
            <button
              key={n}
              className={`chip${rangeLen === n ? " active" : ""}`}
              onClick={() => setRangeLen(n)}
            >
              {t(n === 7 ? "trends.days7" : "trends.days30")}
            </button>
          ))}
        </div>
      </div>

      <div className={`streak-chip${streak > 0 ? " on" : ""}`}>
        {streak > 0 ? t("trends.streak", { n: streak }) : t("trends.streakNone")}
      </div>

      <section className="card">
        <h3 className="section-label">{t("trends.calories")}</h3>
        {loggedInView.length === 0 ? (
          <p className="muted small">{t("trends.noData")}</p>
        ) : (
          <KcalBarChart dates={viewDates} byDate={byDate} goal={goals.kcal} />
        )}
      </section>

      <section className="card progress-card">
        <h3 className="section-label">{t("trends.avg")}</h3>
        <MacroProgress
          label={t("product.calories")}
          consumed={avg.kcal}
          goal={goals.kcal}
          unit="kcal"
        />
        <MacroProgress
          label={t("dash.protein")}
          consumed={avg.protein}
          goal={goals.protein}
          unit="g"
          color="var(--c-protein)"
        />
        <MacroProgress
          label={t("dash.carbs")}
          consumed={avg.carbs}
          goal={goals.carbs}
          unit="g"
          color="var(--c-carbs)"
        />
        <MacroProgress
          label={t("dash.fat")}
          consumed={avg.fat}
          goal={goals.fat}
          unit="g"
          color="var(--c-fat)"
        />
      </section>

      <section className="card">
        <h3 className="section-label">{t("trends.weight")}</h3>
        <form className="weight-form" onSubmit={saveWeight}>
          <input
            type="number"
            step="0.1"
            min="20"
            max="500"
            placeholder={t("trends.weightKg")}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button className="btn primary" disabled={savingWeight || !weightInput}>
            {savingWeight ? t("common.saving") : t("trends.logWeight")}
          </button>
        </form>
        {weights.length === 0 ? (
          <p className="muted small">{t("trends.noWeights")}</p>
        ) : (
          <WeightChart weights={weights} />
        )}
      </section>
    </div>
  );
}
