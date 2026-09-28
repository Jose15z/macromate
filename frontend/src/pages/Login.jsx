import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import AuthHero from "../components/AuthHero";
import { useT } from "../i18n";

export default function Login() {
  const { login } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      const from = location.state?.from;
      navigate(from ? from.pathname + from.search : "/", { replace: true });
    } catch (err) {
      setError(err.message || t("auth.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthHero tagline={t("auth.loginTagline")} />
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
        <label>
          {t("auth.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? t("auth.loggingIn") : t("auth.login")}
        </button>
        <Link to="/forgot" className="muted small" style={{ textAlign: "center" }}>
          {t("auth.forgot")}
        </Link>
      </form>
      <p className="muted">
        {t("auth.noAccount")} <Link to="/register">{t("auth.createOne")}</Link>
      </p>
    </div>
  );
}
