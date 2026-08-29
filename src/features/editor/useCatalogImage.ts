import { useEffect, useState } from "react";

const cache = new Map<string, HTMLImageElement>();

/**
 * Loads a catalog image once and reuses the decoded element. Missing files
 * resolve to null so the caller can fall back to the stroke icon.
 */
export function useCatalogImage(src: string | null): HTMLImageElement | null {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!src || cache.has(src)) return;
    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      cache.set(src, element);
      if (!cancelled) bump((n) => n + 1);
    };
    element.onerror = () => {
      if (!cancelled) bump((n) => n + 1);
    };
    element.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return src ? (cache.get(src) ?? null) : null;
}
