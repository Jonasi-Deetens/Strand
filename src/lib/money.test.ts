import { describe, expect, it } from "vitest";
import { lineTotalExVat, lineTotalIncVat, parseAmountInput } from "./money";

describe("parseAmountInput", () => {
  it("reads Dutch notation with a decimal comma", () => {
    expect(parseAmountInput("1.234,50")).toBe(123450);
    expect(parseAmountInput("1234,50")).toBe(123450);
  });

  it("reads English notation with a decimal point", () => {
    expect(parseAmountInput("1,234.50")).toBe(123450);
    expect(parseAmountInput("1234.5")).toBe(123450);
  });

  it("ignores currency symbols and rejects nonsense", () => {
    expect(parseAmountInput("€ 950")).toBe(95000);
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
  });
});

describe("line totals", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineTotalExVat(8, 145000)).toBe(1160000);
  });

  it("adds VAT", () => {
    expect(lineTotalIncVat(1, 100000, 21)).toBe(121000);
    expect(lineTotalIncVat(3, 33333, 9)).toBe(108999);
  });
});
