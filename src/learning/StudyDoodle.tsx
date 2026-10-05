const drawings = {
  notebook: (
    <>
      <path fill="#e4def4" stroke="none" d="M25 28 91 19 101 94 35 102Z" />
      <path fill="#fffef9" d="m24 22 64-7 8 76-66 8Z" />
      <path d="m37 22 7 73M21 36l13-2M23 51l13-2M25 66l13-2M27 81l13-2M48 37l27-3M50 48l24-3M53 72l7 6 15-19" />
      <path d="m99 25 3-8 3 8 8 3-8 3-3 8-3-8-8-3ZM9 76l-4 4m7 4-4 5" />
      <path stroke="#b6aacd" d="M36 109q29 5 54-4" />
    </>
  ),
  pencil: (
    <>
      <path
        fill="#fae9c8"
        stroke="none"
        d="M21 60q-8-33 31-40t52 23q8 31-31 42T21 60"
      />
      <path fill="#fffef9" d="m31 81 8-23 44-39q5-4 10 1l5 6q4 5 0 9L54 74Z" />
      <path d="m39 58 15 16M78 23l15 16M45 62l37-33M35 71l7 7M30 82l-4 5M16 99q18-13 36-3t34-3" />
      <path d="m17 32 3-8 3 8 8 3-8 3-3 8-3-8-8-3M93 70l7 1m-5-12 6-3m-10 23 4 5" />
    </>
  ),
  orbit: (
    <>
      <path
        fill="#dfedf3"
        stroke="none"
        d="M34 27q30-12 45 12t-1 45q-31 20-50-4T34 27"
      />
      <ellipse cx="59" cy="59" rx="42" ry="16" transform="rotate(-31 59 59)" />
      <ellipse cx="59" cy="59" rx="16" ry="42" transform="rotate(-31 59 59)" />
      <circle cx="59" cy="59" r="5" fill="#a9bdc8" />
      <circle cx="21" cy="72" r="4" fill="#fffef9" />
      <path d="m97 17 2-8 3 8 8 3-8 3-3 8-2-8-8-3M20 101l-4 5m14-3-1 7M91 92q9 1 13-5" />
    </>
  ),
  sprout: (
    <>
      <path
        fill="#e0eccd"
        stroke="none"
        d="M19 60q-4-30 33-36t49 34q-1 31-43 33T19 60"
      />
      <path d="M59 100q-3-34 4-64M60 76Q24 72 24 45q29-1 37 26M62 58q29-3 34-29-30-4-34 29" />
      <path d="m35 55 23 20M85 39 63 58M35 102q24-8 49 0M27 108q30-5 64-1M44 25l-5-7m17 2 1-10m16 12 5-7" />
    </>
  ),
};

export function StudyDoodle({
  kind,
  className = "",
}: {
  kind: keyof typeof drawings;
  className?: string;
}) {
  return (
    <svg
      className={`study-doodle doodle-${kind} ${className}`}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="doodle-ink">{drawings[kind]}</g>
    </svg>
  );
}
