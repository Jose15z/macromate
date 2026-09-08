import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Goals() {
  const { user, profile, saveProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [kcal, setKcal] = useState(profile?.kcal_goal ?? 2000);
  const [protein, setProtein] = useState(profile?.protein_goal ?? 150);
  const [carbs, setCarbs] = useState(profile?.carbs_goal ?? 250);
  const [fat, setFat] = useState(profile?.fat_goal ?? 70);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      await saveProfile({
        display_name: displayName.trim(),
        kcal_goal: Number(kcal),
        protein_goal: Number(protein),
        carbs_goal: Number(carbs),
        fat_goal: Number(fat),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save your goals");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const macroKcal = Number(protein) * 4 + Number(carbs) * 4 + Number(fat) * 9;

  return (
    <div className="goals-page">
      <h2>Profile & daily targets</h2>
      <p className="muted small">Signed in as {user?.email}</p>

      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          Daily calories (kcal)
          <input type="number" min="1" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
        </label>
        <div className="grid-2">
          <label>
            Protein (g)
            <input type="number" min="1" value={protein} onChange={(e) => setProtein(e.target.value)} required />
          </label>
          <label>
            Carbohydrates (g)
            <input type="number" min="1" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
          </label>
          <label>
            Fat (g)
            <input type="number" min="1" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </label>
        </div>
        <p className="muted small">
          Your macro targets add up to ≈{Math.round(macroKcal).toLocaleString()} kcal
          (4 kcal/g protein & carbs, 9 kcal/g fat).
        </p>

        {error && <div className="error">{error}</div>}
        {saved && <div className="success">Saved ✓</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => navigate("/")} disabled={busy}>
            ← Diary
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save targets"}
          </button>
        </div>
      </form>

      <button className="btn ghost danger-text" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
