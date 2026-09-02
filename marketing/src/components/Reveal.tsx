"use client";

import { useEffect, useRef, useState } from "react";

// Fades a section up into view once, the first time it nears the viewport.
// Falls back to visible immediately if IntersectionObserver is unavailable
// or the user prefers reduced motion (handled in CSS).
export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  as?: "div" | "section" | "article" | "li";
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- defensive fallback for environments without IO
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={`reveal ${shown ? "in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  );
}
