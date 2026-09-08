export default function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="logo-mark"
    >
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path
        d="M44 14c-14 2-24 10-24 24 0 6 2 10 4 12 1-8 4-16 12-24-6 8-9 16-10 25 2 1 5 2 8 2 12 0 16-12 16-24 0-6-2-12-6-15z"
        fill="var(--card)"
      />
    </svg>
  );
}
