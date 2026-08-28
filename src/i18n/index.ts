import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import nl from "./locales/nl.json";
import en from "./locales/en.json";

export const LANGUAGES = ["nl", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "strand.language";

export function storedLanguage(): Language {
  if (typeof localStorage === "undefined") return "nl";
  const stored = localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.includes(stored as Language) ? (stored as Language) : "nl";
}

export function setLanguage(language: Language): void {
  localStorage.setItem(STORAGE_KEY, language);
  void i18next.changeLanguage(language);
  document.documentElement.lang = language;
}

void i18next.use(initReactI18next).init({
  resources: { nl: { translation: nl }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: "nl",
  interpolation: { escapeValue: false },
});

export default i18next;
