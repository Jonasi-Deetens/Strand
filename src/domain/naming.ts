import { type ItemType } from "./types";

export type Lang = "nl" | "en";

export function itemTypeName(itemType: ItemType, lang: Lang): string {
  return lang === "en" ? itemType.nameEn : itemType.nameNl;
}

export function lineTitle(
  itemType: ItemType,
  variant: string | null,
  lang: Lang,
): string {
  const base = itemTypeName(itemType, lang);
  return variant ? `${base} (${variant})` : base;
}
