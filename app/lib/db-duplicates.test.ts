import { describe, expect, it } from "vitest";
import {
  dbDuplicatesFound,
  formatDbDuplicateReport,
  type DbDuplicateReport,
} from "./db-duplicates";

describe("formatDbDuplicateReport", () => {
  it("says clean when nothing collides", () => {
    const report: DbDuplicateReport = {
      emails: [],
      productIds: [],
      variantSkus: [],
    };
    expect(dbDuplicatesFound(report)).toBe(false);
    expect(formatDbDuplicateReport(report)).toMatch(/No duplicate/);
  });

  it("lists every colliding key", () => {
    const report: DbDuplicateReport = {
      emails: [{ key: "a@b.com", count: 2, ids: ["1", "2"] }],
      productIds: [{ key: "runner", count: 2, ids: ["a", "b"] }],
      variantSkus: [{ key: "sku-1", count: 2, ids: ["runner", "boot"] }],
    };
    expect(dbDuplicatesFound(report)).toBe(true);
    const text = formatDbDuplicateReport(report);
    expect(text).toContain("a@b.com");
    expect(text).toContain("runner");
    expect(text).toContain("sku-1");
  });
});
