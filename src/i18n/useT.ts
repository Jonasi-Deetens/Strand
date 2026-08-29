import { useTranslation } from "react-i18next";

/** Thin wrapper so components import one short hook instead of the namespace. */
export function useT() {
  return useTranslation().t;
}

export function useLanguage() {
  return useTranslation().i18n.language as "nl" | "en";
}
