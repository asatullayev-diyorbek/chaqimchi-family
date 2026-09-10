/* eslint-disable @next/next/no-img-element */

/** The Spino24 wordmark (green "Spino" + orange "24" + blue swoosh). */
export default function Logo({ className }: { className?: string }) {
  return <img src="/spino24-logo.png" alt="Spino24" className={className} />;
}
