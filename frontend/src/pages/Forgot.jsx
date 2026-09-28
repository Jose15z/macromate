import { useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api";
import AuthHero from "../components/AuthHero";
import { useT } from "../i18n";

export default function Forgot() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthHero tagline={t("forgot.text")} />
      <h2>{t("forgot.title")}</h2>
      {sent ? (
        <div className="card">
          <p className="success">{t("forgot.sent")}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form card">
          <label>
            {t("auth.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" disabled={busy}>
            {busy ? t("forgot.sending") : t("forgot.send")}
          </button>
        </form>
      )}
      <p className="muted">
        <Link to="/login">{t("auth.login")}</Link>
      </p>
    </div>
  );
}
