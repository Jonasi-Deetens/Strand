import { describe, expect, it } from "vitest";
import { completionRatio, isDone, nextStatus, rollupStatus } from "./status";

describe("rollupStatus", () => {
  it("takes the lowest status of the group", () => {
    expect(rollupStatus(["gebouwd", "besteld", "gebouwd"])).toBe("besteld");
    expect(rollupStatus(["gebouwd", "gebouwd"])).toBe("gebouwd");
  });

  it("treats an empty group as still needed", () => {
    expect(rollupStatus([])).toBe("nodig");
  });

  it("ignores cancelled objects unless everything is cancelled", () => {
    expect(rollupStatus(["vervallen", "gebouwd"])).toBe("gebouwd");
    expect(rollupStatus(["vervallen", "vervallen"])).toBe("vervallen");
  });
});

describe("completionRatio", () => {
  it("counts delivered and built objects", () => {
    expect(completionRatio(["gebouwd", "geleverd", "nodig", "besteld"])).toBe(0.5);
    expect(completionRatio([])).toBe(0);
    expect(completionRatio(["vervallen"])).toBe(0);
  });
});

describe("nextStatus", () => {
  it("walks forward and stops at built", () => {
    expect(nextStatus("nodig")).toBe("offerte_aangevraagd");
    expect(nextStatus("geleverd")).toBe("gebouwd");
    expect(nextStatus("gebouwd")).toBe("gebouwd");
  });

  it("brings a cancelled item back into play", () => {
    expect(nextStatus("vervallen")).toBe("nodig");
  });
});

describe("isDone", () => {
  it("is true once something is on the beach", () => {
    expect(isDone("geleverd")).toBe(true);
    expect(isDone("gebouwd")).toBe(true);
    expect(isDone("besteld")).toBe(false);
  });
});
