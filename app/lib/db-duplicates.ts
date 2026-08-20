import type { Db } from "mongodb";

export type DuplicateGroup = {
  key: string;
  count: number;
  ids: string[];
};

export type DbDuplicateReport = {
  emails: DuplicateGroup[];
  productIds: DuplicateGroup[];
  variantSkus: DuplicateGroup[];
};

function hasDuplicates(report: DbDuplicateReport): boolean {
  return (
    report.emails.length > 0 ||
    report.productIds.length > 0 ||
    report.variantSkus.length > 0
  );
}

/**
 * Scan for values that would prevent the unique indexes in `ensureIndexes`
 * from building (or that already violate them).
 *
 * Safe to run against production: read-only aggregations only.
 */
export async function findDbDuplicates(db: Db): Promise<DbDuplicateReport> {
  const [emails, productIds, variantSkus] = await Promise.all([
    db
      .collection("users")
      .aggregate<{ _id: string; count: number; ids: string[] }>([
        { $group: { _id: "$email", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    db
      .collection("products")
      .aggregate<{ _id: string; count: number; ids: string[] }>([
        { $group: { _id: "$id", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    db
      .collection("products")
      .aggregate<{ _id: string; count: number; ids: string[] }>([
        { $match: { "variants.0": { $exists: true } } },
        { $unwind: "$variants" },
        {
          $group: {
            _id: "$variants.sku",
            count: { $sum: 1 },
            ids: { $addToSet: "$id" },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
  ]);

  return {
    emails: emails.map((row) => ({
      key: String(row._id),
      count: row.count,
      ids: row.ids.map(String),
    })),
    productIds: productIds.map((row) => ({
      key: String(row._id),
      count: row.count,
      ids: row.ids.map(String),
    })),
    variantSkus: variantSkus.map((row) => ({
      key: String(row._id),
      count: row.count,
      ids: row.ids.map(String),
    })),
  };
}

export function dbDuplicatesFound(report: DbDuplicateReport): boolean {
  return hasDuplicates(report);
}

export function formatDbDuplicateReport(report: DbDuplicateReport): string {
  if (!hasDuplicates(report)) {
    return "No duplicate emails, product ids, or variant SKUs found.";
  }

  const lines: string[] = [
    "Unique-index blockers found. Dedupe these before deploy:",
  ];

  if (report.emails.length) {
    lines.push("", "users.email:");
    for (const row of report.emails) {
      lines.push(`  ${row.key} ×${row.count} (docs: ${row.ids.join(", ")})`);
    }
  }
  if (report.productIds.length) {
    lines.push("", "products.id:");
    for (const row of report.productIds) {
      lines.push(`  ${row.key} ×${row.count} (docs: ${row.ids.join(", ")})`);
    }
  }
  if (report.variantSkus.length) {
    lines.push("", "products.variants.sku:");
    for (const row of report.variantSkus) {
      lines.push(
        `  ${row.key} ×${row.count} (product ids: ${row.ids.join(", ")})`
      );
    }
  }

  return lines.join("\n");
}
