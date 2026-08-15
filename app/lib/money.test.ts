import { describe, expect, it } from "vitest";
import { formatMoney } from "@/app/lib/money";

describe("formatMoney", () => {
  it("renders German euro amounts with a regular space before the sign", () => {
    expect(formatMoney(89.99)).toBe("89,99 €");
    expect(formatMoney(89.99)).not.toMatch(/[\u00A0\u202F]/);
  });
});
