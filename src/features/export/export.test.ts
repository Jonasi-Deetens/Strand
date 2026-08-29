import { describe, expect, it } from "vitest";
import {
  barType,
  beach,
  cabinType,
  makeDocument,
  makeObject,
} from "@/test/factories";
import { syncDerived } from "@/domain/sync";
import { mToMm } from "@/lib/units";
import { buildDxf } from "./dxf";
import { chooseScale, layoutFor, sheetForScale } from "./pdf";
import { parseProject, serialiseProject } from "./projectFile";

const planned = () =>
  syncDerived(
    makeDocument({
      objects: [
        makeObject({
          id: "ob_bar",
          itemTypeId: barType.id,
          wMm: mToMm(12),
          hMm: mToMm(5),
          xMm: mToMm(10),
          yMm: mToMm(8),
          status: "gebouwd",
        }),
        makeObject({
          id: "ob_cabine",
          itemTypeId: cabinType.id,
          xMm: mToMm(30),
          yMm: mToMm(40),
          rotationDeg: 45,
        }),
      ],
    }),
    "nl",
  );

describe("buildDxf", () => {
  const dxf = buildDxf(planned(), { lang: "nl" });

  it("writes a valid DXF envelope in millimetres", () => {
    expect(dxf.startsWith("0\nSECTION")).toBe(true);
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    // $INSUNITS 4 is millimetres.
    expect(dxf).toContain("$INSUNITS");
  });

  it("puts every category on its own layer", () => {
    expect(dxf).toContain("PERCEEL");
    expect(dxf).toContain("GEBOUW");
    expect(dxf).toContain("CABINE");
    expect(dxf).toContain("TEKST");
  });

  it("labels the objects and the plot", () => {
    expect(dxf).toContain("Strandbar");
    expect(dxf).toContain("Strandcabine");
    expect(dxf).toContain("Strandpaviljoen");
  });

  it("flips the Y axis so the drawing is not upside down", () => {
    // The bar sits 8 m from the top of a 70 m deep plot, so its top edge is at
    // 62 m in CAD space where Y grows upwards.
    expect(dxf).toContain(`\n${beach.hMm - mToMm(8)}\n`);
  });

  it("uses the English catalogue names when asked", () => {
    const english = buildDxf(planned(), { lang: "en" });
    expect(english).toContain("Beach bar");
    expect(english).not.toContain("Strandbar");
  });

  it("dimensions the plot with real geometry rather than DIMENSION entities", () => {
    // A DIMENSION only points at a block this writer cannot generate, so CAD
    // tools that do not regenerate it from the dimension style draw nothing.
    expect(dxf).not.toContain("\nDIMENSION\n");
    expect(dxf).toContain("MAATLIJN");
    expect(dxf).toContain("60,00 m");
    expect(dxf).toContain("70,00 m");
  });
});

describe("chooseScale", () => {
  const frame = { x: 0, y: 0, width: 280, height: 240 };

  it("picks the most detailed standard scale that still fits", () => {
    // 60 x 70 m at 1:250 is 240 x 280 mm, too tall for a 280 x 240 frame.
    expect(chooseScale(beach, frame)).toBe(500);
    // A 12 x 5 m bar is 600 mm wide at 1:20, so 1:50 is the first that fits.
    expect(chooseScale({ ...beach, wMm: mToMm(12), hMm: mToMm(5) }, frame)).toBe(
      50,
    );
  });

  it("falls back to the coarsest scale for an enormous plot", () => {
    expect(
      chooseScale({ ...beach, wMm: mToMm(5000), hMm: mToMm(5000) }, frame),
    ).toBe(1000);
  });
});

describe("sheetForScale", () => {
  it("grows the paper until the drawing fits at the asked scale", () => {
    // 60 x 70 m at 1:100 is 600 x 700 mm of drawing, which only A0 holds.
    expect(sheetForScale(beach, 100)).toMatchObject({
      name: "a0",
      orientation: "portrait",
    });
    // A 12 x 5 m bar interior is 120 x 50 mm, so A4 is plenty.
    expect(
      sheetForScale({ ...beach, wMm: mToMm(12), hMm: mToMm(5) }, 100),
    ).toMatchObject({ name: "a4", orientation: "landscape" });
  });

  it("gives up when even A0 is too small", () => {
    expect(sheetForScale({ wMm: mToMm(5000), hMm: mToMm(5000) }, 100)).toBeNull();
  });
});

describe("layoutFor", () => {
  it("keeps the requested scale and reports the paper it needs", () => {
    expect(layoutFor(beach, 100)).toMatchObject({
      scale: 100,
      sheet: { name: "a0" },
    });
  });

  it("falls back to fitting an A3 when the scale cannot be honoured", () => {
    const huge = { wMm: mToMm(5000), hMm: mToMm(5000) };
    expect(layoutFor(huge, 100)).toMatchObject({
      scale: 1000,
      sheet: { name: "a3" },
    });
  });

  it("fits the plot on A3 when asked to", () => {
    // A3 portrait leaves a 257 x 314 mm frame, which holds 60 x 70 m at 1:250.
    const { sheet, scale } = layoutFor(beach, "fit");
    expect(sheet).toMatchObject({ name: "a3", orientation: "portrait" });
    expect(scale).toBe(250);
  });
});

describe("project file", () => {
  it("round-trips the document", () => {
    const doc = planned();
    const parsed = parseProject(serialiseProject(doc));
    expect(parsed).toEqual(doc);
  });

  it("refuses foreign files", () => {
    expect(() => parseProject('{"format":"something-else"}')).toThrow();
    expect(() =>
      parseProject('{"format":"strand-project","version":99,"document":{}}'),
    ).toThrow();
  });

  it("defaults a missing cabin stock list so older exports still open", () => {
    const file = JSON.parse(serialiseProject(planned())) as {
      document: { cabinStock?: unknown };
    };
    delete file.document.cabinStock;
    expect(parseProject(JSON.stringify(file)).cabinStock).toEqual([]);
  });
});
