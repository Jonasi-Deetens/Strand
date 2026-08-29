import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import { SHORTCUT_GROUPS } from "@/features/editor/shortcuts";

type Tree = { [key: string]: string | Tree };

function keyPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : keyPaths(value, path);
  });
}

function lookup(tree: Tree, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<string | Tree | undefined>(
      (current, part) =>
        typeof current === "object" && current ? current[part] : undefined,
      tree,
    );
  return typeof value === "string" ? value : undefined;
}

describe("locales", () => {
  const nlKeys = keyPaths(nl as Tree);
  const enKeys = keyPaths(en as Tree);

  it("has the same keys in Dutch and English", () => {
    expect(enKeys.filter((key) => !nlKeys.includes(key))).toEqual([]);
    expect(nlKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("has no empty translations", () => {
    for (const key of nlKeys) {
      expect(lookup(nl as Tree, key), key).toBeTruthy();
      expect(lookup(en as Tree, key), key).toBeTruthy();
    }
  });

  it("translates every shortcut label", () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(lookup(nl as Tree, group.titleKey), group.titleKey).toBeTruthy();
      for (const shortcut of group.items) {
        expect(
          lookup(nl as Tree, shortcut.labelKey),
          shortcut.labelKey,
        ).toBeTruthy();
        if (shortcut.keysKey) {
          expect(
            lookup(en as Tree, shortcut.keysKey),
            shortcut.keysKey,
          ).toBeTruthy();
        } else {
          expect(shortcut.keys, shortcut.labelKey).toBeTruthy();
        }
      }
    }
  });
});
