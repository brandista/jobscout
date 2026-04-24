import { useEffect, useState } from "react";

const STORAGE_KEY = "jobscout.editorial";
const URL_PARAM = "editorial";

/**
 * Returns whether the editorial chrome is enabled.
 *
 * Resolution order (first match wins):
 *  1. URL param `?editorial=1` / `?editorial=0` — also persists to localStorage
 *  2. localStorage value set by #1 or by toggle()
 *  3. Vite env var VITE_EDITORIAL (build-time default)
 *  4. `false`
 *
 * Returns a tuple [enabled, toggle].
 */
export function useEditorialFlag(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => resolve());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(resolve());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = () => {
    const next = !enabled;
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    setEnabled(next);
  };

  return [enabled, toggle];
}

function resolve(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  const param = url.searchParams.get(URL_PARAM);
  if (param === "1" || param === "0") {
    localStorage.setItem(STORAGE_KEY, param);
    return param === "1";
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;

  return import.meta.env.VITE_EDITORIAL === "1";
}
