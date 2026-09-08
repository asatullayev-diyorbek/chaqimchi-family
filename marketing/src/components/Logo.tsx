export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left ear */}
      <path d="M 18 36 A 8 8 0 0 0 18 48" />
      {/* Right ear */}
      <path d="M 87 36 A 6 6 0 0 1 87 46" />
      {/* Hair */}
      <path d="M 28 16 L 70 22 L 70 30" />
      {/* Left Glass */}
      <circle cx="34" cy="42" r="16" />
      {/* Right Glass */}
      <circle cx="74" cy="42" r="13" />
      {/* Bridge */}
      <path d="M 50 42 L 61 42" />
      {/* Jaw */}
      <path d="M 26 56 L 26 86 L 78 86 L 78 54" />
      {/* Smile */}
      <path d="M 42 70 Q 55 80 66 66" />
      
      {/* Pupils (filled) */}
      <circle cx="38" cy="42" r="5" fill="currentColor" stroke="none" />
      <circle cx="76" cy="42" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
