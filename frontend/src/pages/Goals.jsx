import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import { useAuth } from "../AuthContext";
import Icon from "../components/Icon";
import { useT } from "../i18n";

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const OBJECTIVE_ADJUST = { lose: 0.85, maintain: 1.0, gain: 1.1 };

function TargetCalculator({ onApply }) {
  const { t } = useT();
  const [sex, setSex] = useState("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("light");
  const [objective, setObjective] = useState("maintain");

  const a = Number(age);
  const h = Number(height);
  const w = Number(weight);
  let result = null;
  if (a > 0 && h > 0 && w > 0) {
    // Mifflin-St Jeor
    const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "male" ? 5 : -161);
    const kcal = Math.round(bmr * ACTIVITY_FACTORS[activity] * OBJECTIVE_ADJUST[objective]);
    const protein = Math.round(w * 1.8);
    const fat = Math.round((kcal * 0.25) / 9);
    const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    result = { kcal, protein, fat, carbs: Math.max(carbs, 0) };
  }

  return (
    <div className="calc card form">
      <p className="muted small">{t("goals.calcIntro")}</p>
      <label>
        {t("goals.sex")}
        <div className="chip-row">
          {["male", "female"].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${sex === s ? " active" : ""}`}
              onClick={() => setSex(s)}
            >
              {t(s === "male" ? "goals.male" : "goals.female")}
            </button>
          ))}
        </div>
      </label>
      <div className="grid-2">
        <label>
          {t("goals.age")}
          <input type="number" min="10" max="110" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label>
          {t("goals.height")}
          <input type="number" min="100" max="250" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label>
          {t("goals.weight")}
          <input type="number" min="25" max="400" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          {t("goals.activity")}
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {Object.keys(ACTIVITY_FACTORS).map((k) => (
              <option key={k} value={k}>
                {t(`goals.act.${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t("goals.objective")}
        <div className="chip-row">
          {["lose", "maintain", "gain"].map((o) => (
            <button
              key={o}
              type="button"
              className={`chip${objective === o ? " active" : ""}`}
              onClick={() => setObjective(o)}
            >
              {t(`goals.obj.${o}`)}
            </button>
          ))}
        </div>
      </label>

      {result && (
        <>
          <div className="macro-preview">
            <span>≈{result.kcal.toLocaleString()} kcal</span>
            <span>P {result.protein} g</span>
            <span>C {result.carbs} g</span>
            <span>F {result.fat} g</span>
          </div>
          <button type="button" className="btn primary" onClick={() => onApply(result)}>
            {t("goals.applyCalc")}
          </button>
        </>
      )}
    </div>
  );
}

function AccountSection() {
  const { t, lang, setLang } = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState(null); // {ok, text}
  const [pwBusy, setPwBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [exportErr, setExportErr] = useState("");

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: t("auth.passwordTooShort") });
      return;
    }
    setPwBusy(true);
    try {
      await api.changePassword(currentPw, newPw);
      setPwMsg({ ok: true, text: t("account.passwordChanged") });
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setPwBusy(false);
    }
  }

  async function handleExport() {
    setExportErr("");
    try {
      await api.downloadExport();
    } catch (err) {
      setExportErr(err.message || t("account.exportError"));
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteErr("");
    try {
      await api.deleteAccount(deletePw);
      api.setToken(null);
      window.location.assign("/login");
    } catch (err) {
      setDeleteErr(err.message);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <section className="card form">
      <h3 className="section-label">{t("account.title")}</h3>
      <p className="muted small">{t("goals.signedInAs", { email: user?.email })}</p>

      <label>
        {t("account.language")}
        <div className="chip-row">
          <button
            type="button"
            className={`chip${lang === "es" ? " active" : ""}`}
            onClick={() => setLang("es")}
          >
            Español
          </button>
          <button
            type="button"
            className={`chip${lang === "en" ? " active" : ""}`}
            onClick={() => setLang("en")}
          >
            English
          </button>
        </div>
      </label>

      <form onSubmit={handleChangePassword} className="form">
        <div className="grid-2">
          <label>
            {t("account.currentPassword")}
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            {t("account.newPassword")}
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        {pwMsg && (
          <div className={pwMsg.ok ? "success" : "error"}>{pwMsg.text}</div>
        )}
        <button className="btn" disabled={pwBusy || !currentPw || !newPw} style={{ alignSelf: "start" }}>
          {pwBusy ? t("common.saving") : t("account.changePassword")}
        </button>
      </form>

      <div className="account-actions">
        <button type="button" className="btn" onClick={handleExport}>
          <Icon name="download" size={14} />
          {t("account.export")}
        </button>
        <button type="button" className="btn ghost danger-text" onClick={() => setDeleting((v) => !v)}>
          {t("account.delete")}
        </button>
        <button type="button" className="btn ghost" onClick={handleLogout}>
          {t("account.logout")}
        </button>
      </div>
      {exportErr && <div className="error">{exportErr}</div>}

      {deleting && (
        <form onSubmit={handleDelete} className="form delete-box">
          <p className="error small">{t("account.deleteWarning")}</p>
          <input
            type="password"
            value={deletePw}
            onChange={(e) => setDeletePw(e.target.value)}
            placeholder={t("auth.password")}
            autoComplete="current-password"
          />
          {deleteErr && <div className="error">{deleteErr}</div>}
          <button className="btn danger-text" disabled={!deletePw} style={{ alignSelf: "start" }}>
            {t("account.deleteBtn")}
          </button>
        </form>
      )}
    </section>
  );
}

export default function Goals() {
  const { user, profile, saveProfile } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [kcal, setKcal] = useState(profile?.kcal_goal ?? 2000);
  const [protein, setProtein] = useState(profile?.protein_goal ?? 150);
  const [carbs, setCarbs] = useState(profile?.carbs_goal ?? 250);
  const [fat, setFat] = useState(profile?.fat_goal ?? 70);
  const [showCalc, setShowCalc] = useState(false);
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
      setError(err.message || t("goals.saveError"));
    } finally {
      setBusy(false);
    }
  }

  function applyCalc(result) {
    setKcal(result.kcal);
    setProtein(result.protein);
    setCarbs(result.carbs);
    setFat(result.fat);
    setShowCalc(false);
    setSaved(false);
  }

  const macroKcal = Number(protein) * 4 + Number(carbs) * 4 + Number(fat) * 9;

  return (
    <div className="goals-page">
      <h2>{t("goals.title")}</h2>

      <form className="card form" onSubmit={handleSubmit}>
        <label>
          {t("goals.displayName")}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          {t("goals.dailyCalories")}
          <input type="number" min="1" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
        </label>
        <div className="grid-2">
          <label>
            {t("dash.protein")} (g)
            <input type="number" min="1" value={protein} onChange={(e) => setProtein(e.target.value)} required />
          </label>
          <label>
            {t("dash.carbs")} (g)
            <input type="number" min="1" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
          </label>
          <label>
            {t("dash.fat")} (g)
            <input type="number" min="1" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </label>
        </div>
        <p className="muted small">
          {t("goals.macroSum", { kcal: Math.round(macroKcal).toLocaleString() })}
        </p>

        <button
          type="button"
          className="btn ghost"
          style={{ alignSelf: "start" }}
          onClick={() => setShowCalc((v) => !v)}
        >
          <Icon name="sparkles" size={14} />
          {t("goals.calc")}
        </button>
        {showCalc && <TargetCalculator onApply={applyCalc} />}

        {error && <div className="error">{error}</div>}
        {saved && <div className="success">{t("common.saved")}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => navigate("/")} disabled={busy}>
            {t("goals.diary")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("common.saving") : t("goals.saveTargets")}
          </button>
        </div>
      </form>

      {user && <AccountSection />}
    </div>
  );
}
