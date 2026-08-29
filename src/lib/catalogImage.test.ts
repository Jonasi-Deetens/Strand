import { describe, expect, it } from "vitest";
import { catalogImageUrl } from "./catalogImage";

describe("catalogImageUrl", () => {
  it("prefixes a stored relative path", () => {
    expect(catalogImageUrl("catalog/it_stoel.webp")).toBe(
      "/catalog/it_stoel.webp",
    );
  });

  it("leaves an absolute path alone", () => {
    expect(catalogImageUrl("/catalog/it_stoel.webp")).toBe(
      "/catalog/it_stoel.webp",
    );
  });

  it("returns null when the type has no picture", () => {
    expect(catalogImageUrl(null)).toBeNull();
    expect(catalogImageUrl(undefined)).toBeNull();
  });
});
