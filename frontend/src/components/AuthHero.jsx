import Logo from "./Logo";

/* Decorative bowl illustration + wordmark for the auth pages. */
export default function AuthHero({ tagline }) {
  return (
    <div className="auth-hero">
      <svg viewBox="0 0 240 130" className="auth-hero-art" aria-hidden="true">
        {/* steam */}
        <path
          d="M104 26c-4-6 4-8 0-14M120 22c-4-6 4-8 0-14M136 26c-4-6 4-8 0-14"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* bowl */}
        <path
          d="M52 52h136c0 30-20 50-42 56l-2 8H96l-2-8c-22-6-42-26-42-56z"
          fill="var(--accent)"
        />
        <path
          d="M52 52h136c0 6-1 11-2 16H54c-1-5-2-10-2-16z"
          fill="var(--accent-strong)"
          opacity="0.55"
        />
        {/* leaf garnish */}
        <path
          d="M172 40c-12 1-20 7-21 16 8 2 18-3 21-16z"
          fill="var(--accent-strong)"
        />
        <path
          d="M60 38c10-4 19-2 23 5-6 5-17 4-23-5z"
          fill="var(--accent-strong)"
          opacity="0.8"
        />
        {/* chopsticks */}
        <path
          d="M150 8l44 34M162 4l38 40"
          stroke="var(--warn)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
      <div className="auth-hero-brand">
        <Logo size={34} />
        <span className="auth-hero-name">
          Macro<span>Mate</span>
        </span>
      </div>
      {tagline && <p className="muted">{tagline}</p>}
    </div>
  );
}
