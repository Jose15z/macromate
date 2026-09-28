import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api";
import AuthHero from "../components/AuthHero";
import { useT } from "../i18n";

export default function Reset() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthHero />
      <h2>{t("reset.title")}</h2>
      {!token && <div className="error card">{t("reset.invalid")}</div>}
      {done ? (
        <div className="card">
          <p className="success">{t("reset.done")}</p>
          <Link to="/login" className="btn primary" style={{ marginTop: "0.5rem" }}>
            {t("auth.login")}
          </Link>
        </div>
      ) : (
        token && (
          <form onSubmit={handleSubmit} className="form card">
            <label>
              {t("reset.newPassword")}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder={t("auth.passwordMin")}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn primary" disabled={busy}>
              {busy ? t("reset.changing") : t("reset.confirm")}
            </button>
          </form>
        )
      )}
    </div>
  );
}
