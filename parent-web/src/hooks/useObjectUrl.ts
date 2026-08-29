"use client";

import { useEffect, useMemo } from "react";

/**
 * Blob URL for a picked File, revoked when the file changes or the component
 * unmounts.
 *
 * Calling URL.createObjectURL() inline in JSX — which is what this replaces —
 * mints a fresh URL on every single render and never releases any of them, so
 * the blobs pile up in the browser for the life of the tab.
 */
export function useObjectUrl(file: File | undefined | null): string | null {
  // Minted once per file (not per render) and revoked when that file is
  // replaced or the component unmounts. Creating it in a memo rather than an
  // effect keeps the URL available on the first paint — an effect would
  // render one frame with no image, and setting state from an effect is what
  // react-hooks/set-state-in-effect exists to prevent.
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
