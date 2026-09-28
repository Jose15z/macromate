import Logo from "./Logo";

/* Brand lockup for the auth pages. */
export default function AuthHero({ tagline }) {
  return (
    <div className="auth-hero">
      <div className="auth-hero-brand">
        <Logo size={44} />
        <span className="auth-hero-name">
          Macro<span>Mate</span>
        </span>
      </div>
      {tagline && <p className="muted">{tagline}</p>}
    </div>
  );
}
