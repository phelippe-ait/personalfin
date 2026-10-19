type IconProps = {
  name: string;
  size?: number;
  strokeWidth?: number;
};

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...common}
    >
      {name === "arrow-left" && (
        <>
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </>
      )}
      {name === "arrow-right" && (
        <>
          <path d="m9 18 6-6-6-6" />
          <path d="M5 12h10" />
        </>
      )}
      {name === "close" && (
        <>
          <path d="m7 7 10 10" />
          <path d="M17 7 7 17" />
        </>
      )}
      {name === "fork" && (
        <>
          <path d="M7 3v8M4 3v5c0 2 1.3 3 3 3s3-1 3-3V3M7 11v10" />
          <path d="M16 3v18M16 3c2.5 1.5 4 4 4 7h-4" />
        </>
      )}
      {name === "arrow" && (
        <>
          <path d="M5 16 16 5" />
          <path d="M9 5h7v7" />
          <path d="M6 20h12" />
        </>
      )}
      {name === "bag" && (
        <>
          <path d="M5 8h14l-1 13H6L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </>
      )}
      {name === "home" && (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v11h14V10M9 21v-7h6v7" />
        </>
      )}
      {name === "plus" && (
        <>
          <path d="M12 5v14M5 12h14" />
          <circle cx="12" cy="12" r="9" />
        </>
      )}
      {name === "spark" && (
        <>
          <path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" />
          <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
        </>
      )}
      {name === "briefcase" && (
        <>
          <rect height="13" rx="2" width="18" x="3" y="7" />
          <path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2" />
        </>
      )}
      {name === "circle" && <circle cx="12" cy="12" r="7" />}
      {name === "calendar" && (
        <>
          <rect height="17" rx="3" width="18" x="3" y="4" />
          <path d="M8 2v4M16 2v4M3 9h18" />
        </>
      )}
      {name === "check" && <path d="m5 12 4.5 4.5L19 7" />}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </>
      )}
    </svg>
  );
}
