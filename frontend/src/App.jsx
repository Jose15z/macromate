import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Loading from "./components/Loading";
import Logo from "./components/Logo";
import { I18nProvider, useT } from "./i18n";
import AddFood from "./pages/AddFood";
import Dashboard from "./pages/Dashboard";
import Forgot from "./pages/Forgot";
import Goals from "./pages/Goals";
import Login from "./pages/Login";
import ManualFood from "./pages/ManualFood";
import Photo from "./pages/Photo";
import Product from "./pages/Product";
import Recipes from "./pages/Recipes";
import Register from "./pages/Register";
import Reset from "./pages/Reset";
import Trends from "./pages/Trends";

// the barcode-scanning library is heavy — load it only when scanning
const Scan = lazy(() => import("./pages/Scan"));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Header() {
  const { user } = useAuth();
  const { t } = useT();
  return (
    <header className="app-header">
      <NavLink to="/" className="brand">
        <Logo size={26} />
        <span>MacroMate</span>
      </NavLink>
      {user && (
        <nav className="header-nav">
          <NavLink to="/" end>
            {t("nav.diary")}
          </NavLink>
          <NavLink to="/trends">{t("nav.trends")}</NavLink>
          <NavLink to="/goals">{t("nav.goals")}</NavLink>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <main className="app-main">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/reset" element={<Reset />} />
              <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/trends" element={<RequireAuth><Trends /></RequireAuth>} />
              <Route path="/add" element={<RequireAuth><AddFood /></RequireAuth>} />
              <Route path="/recipes" element={<RequireAuth><Recipes /></RequireAuth>} />
              <Route
                path="/scan"
                element={
                  <RequireAuth>
                    <Suspense fallback={<Loading />}>
                      <Scan />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route path="/product/:barcode" element={<RequireAuth><Product /></RequireAuth>} />
              <Route path="/manual" element={<RequireAuth><ManualFood /></RequireAuth>} />
              <Route path="/photo" element={<RequireAuth><Photo /></RequireAuth>} />
              <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
