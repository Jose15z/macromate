const SIZE = 168;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CalorieRing({ consumed, goal }) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const over = goal > 0 && consumed > goal;
  const remaining = Math.round(goal - consumed);

  return (
    <div className="calorie-ring" role="img" aria-label={`${Math.round(consumed)} of ${Math.round(goal)} calories eaten`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={over ? "var(--warn)" : "var(--accent)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="ring-fill"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-value">{Math.round(consumed).toLocaleString()}</span>
        <span className="ring-unit">of {Math.round(goal).toLocaleString()} kcal</span>
        <span className={`ring-remaining${over ? " over" : ""}`}>
          {over
            ? `${Math.abs(remaining).toLocaleString()} over`
            : `${remaining.toLocaleString()} left`}
        </span>
      </div>
    </div>
  );
}
