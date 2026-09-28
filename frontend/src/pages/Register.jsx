import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import AuthHero from "../components/AuthHero";
import { useT } from "../i18n";

export default function Register() {
  const { register } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await register(email.trim(), password, displayName.trim());
      navigate("/goals", { replace: true });
    } catch (err) {
      setError(err.message || t("auth.registerFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthHero tagline={t("auth.registerTagline")} />
      <form onSubmit={handleSubmit} className="form card">
        <label>
          {t("auth.name")}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder={t("auth.namePlaceholder")}
          />
        </label>
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
        <label>
          {t("auth.password")}
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
          {busy ? t("auth.creating") : t("auth.signup")}
        </button>
      </form>
      <p className="muted">
        {t("auth.haveAccount")} <Link to="/login">{t("auth.login")}</Link>
      </p>
    </div>
  );
}
