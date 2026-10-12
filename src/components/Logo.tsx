/**
 * Platform logo — a verification shield with a checkmark, carrying the
 * platform's initials. Drawn as inline SVG so it inherits the owner-editable
 * brand colour (--brand) and stays crisp at any size.
 */
export function LogoMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="شعار تعز الآن"
      className={className}
    >
      <defs>
        <linearGradient id="tn-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="#8a0d16" />
        </linearGradient>
      </defs>
      {/* Shield */}
      <path
        d="M24 3 41 9v13c0 11.5-7.5 19.5-17 23-9.5-3.5-17-11.5-17-23V9L24 3Z"
        fill="url(#tn-shield)"
      />
      {/* Inner keyline */}
      <path
        d="M24 7 37 11.5v10.5c0 9-5.8 15.4-13 18.4-7.2-3-13-9.4-13-18.4V11.5L24 7Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.4"
      />
      {/* Wordmark letter "ت" abstracted + checkmark */}
      <path
        d="M14 20c0-2 1.6-3.5 3.6-3.5 1.9 0 3.4 1.3 3.5 3.2h2.3c.2-3-2.3-5.4-5.8-5.4-3.4 0-6 2.4-6 5.7 0 3 2 5 5.2 6.1l1 .4v2.1h11v-2.4H20.9v-1.6l-2.6-1c-2.5-.9-4.3-1.6-4.3-3.6Z"
        fill="#ffffff"
      />
      <path
        d="M27.5 24.5 23 29.2l-2.4-2.6-1.9 1.7 4.3 4.6 6.6-6.7-2.1-1.7Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Full lockup: mark + brand name + tagline. Used in the masthead and footer. */
export default function Logo({
  name = "تعز الآن",
  tagline = "منصة التحقق الذكي",
  size = 44,
  tone = "dark",
}: {
  name?: string;
  tagline?: string;
  size?: number;
  tone?: "dark" | "light";
}) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span
          className={`headline block text-2xl font-bold md:text-3xl ${
            tone === "light" ? "text-white" : "text-[var(--foreground)]"
          }`}
        >
          {name}
        </span>
        <span
          className={`block text-[11px] tracking-[0.2em] ${
            tone === "light" ? "text-white/60" : "text-[var(--muted)]"
          }`}
        >
          {tagline}
        </span>
      </span>
    </span>
  );
}
