/**
 * An in-memory stand-in for the MongoDB driver, covering exactly the query and
 * update operators this app uses.
 *
 * Why not mock each call site: the cart is an array of subdocuments edited
 * through `$elemMatch` + the positional `$`, and the whole variant feature
 * turns on those matching the right element. A per-call mock would assert that
 * we *sent* an update, not that the update selects the right size. This double
 * actually applies them, so a filter that matches the wrong line fails a test.
 *
 * It is not MongoDB. It does not cover sharding, collation, aggregation, or
 * write concerns, and unique indexes are enforced only where declared below.
 * Anything relying on real driver semantics belongs in an integration test.
 */

type Doc = Record<string, unknown>;

/** Unique indexes worth modelling: each one a race the app relies on. */
const UNIQUE_KEYS: Record<string, string> = {
  users: "email",
  products: "id",
  carts: "userId",
  orders: "stripeSessionId",
  ratelimits: "_id",
  reservations: "reservationId",
};

function duplicateKeyError(collection: string, key: string): Error & { code: number } {
  const err = new Error(
    `E11000 duplicate key error collection: ${collection} index: ${key}_1`
  ) as Error & { code: number };
  err.code = 11000;
  return err;
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.keys(value).some((key) => key.startsWith("$"))
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Resolve a dotted path against a document. */
function getPath(doc: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, doc);
}

/**
 * Range operators work on dates as well as numbers in MongoDB, and the expiry
 * sweep relies on that. Returns null for anything not orderable.
 */
function comparable(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return null;
}

function compare(
  value: unknown,
  operand: unknown,
  ordered: (a: number, b: number) => boolean
): boolean {
  const left = comparable(value);
  const right = comparable(operand);
  return left !== null && right !== null && ordered(left, right);
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!isOperatorObject(condition)) {
    // An equality check against an array field matches if any element matches,
    // mirroring MongoDB.
    if (Array.isArray(value) && !Array.isArray(condition)) {
      return value.some((entry) => deepEqual(entry, condition));
    }
    return deepEqual(value, condition);
  }

  return Object.entries(condition).every(([operator, operand]) => {
    switch (operator) {
      case "$eq":
        return deepEqual(value, operand);
      case "$ne":
        return !deepEqual(value, operand);
      case "$gt":
        return compare(value, operand, (a, b) => a > b);
      case "$gte":
        return compare(value, operand, (a, b) => a >= b);
      case "$lt":
        return compare(value, operand, (a, b) => a < b);
      case "$lte":
        return compare(value, operand, (a, b) => a <= b);
      case "$in":
        return (operand as unknown[]).some((entry) => deepEqual(value, entry));
      case "$nin":
        return !(operand as unknown[]).some((entry) => deepEqual(value, entry));
      case "$exists":
        return (value !== undefined) === Boolean(operand);
      case "$elemMatch":
        return (
          Array.isArray(value) &&
          value.some((entry) => matchesFilter(entry as Doc, operand as Doc).ok)
        );
      default:
        throw new Error(`mongo-double: unsupported query operator ${operator}`);
    }
  });
}

type MatchResult = {
  ok: boolean;
  /** Field name → index of the element the query matched, for positional `$`. */
  positional: Record<string, number>;
};

function matchesFilter(doc: Doc, filter: Doc): MatchResult {
  const positional: Record<string, number> = {};

  for (const [field, condition] of Object.entries(filter)) {
    if (field === "$or") {
      const branches = condition as Doc[];
      if (!branches.some((branch) => matchesFilter(doc, branch).ok)) {
        return { ok: false, positional };
      }
      continue;
    }

    const value = getPath(doc, field);

    // Record which element matched so `field.$.sub` can be applied later.
    if (
      isOperatorObject(condition) &&
      "$elemMatch" in condition &&
      Array.isArray(value)
    ) {
      const index = value.findIndex(
        (entry) => matchesFilter(entry as Doc, condition.$elemMatch as Doc).ok
      );
      if (index < 0) return { ok: false, positional };
      positional[field] = index;
      continue;
    }

    if (!matchesCondition(value, condition)) {
      return { ok: false, positional };
    }
  }

  return { ok: true, positional };
}

function setPath(doc: Doc, path: string, value: unknown, positional: Record<string, number>) {
  const segments = path.split(".");
  let target: Record<string, unknown> = doc;

  for (let i = 0; i < segments.length - 1; i++) {
    let segment = segments[i];
    if (segment === "$") {
      // `items.$.quantity`: the index comes from the filter that matched.
      const field = segments.slice(0, i).join(".");
      const index = positional[field];
      if (index === undefined) {
        throw new Error(`mongo-double: no positional match recorded for ${field}`);
      }
      segment = String(index);
    }
    if (target[segment] === undefined || target[segment] === null) {
      target[segment] = {};
    }
    target = target[segment] as Record<string, unknown>;
  }

  target[segments[segments.length - 1]] = value;
}

function unsetPath(doc: Doc, path: string) {
  const segments = path.split(".");
  let target: Record<string, unknown> = doc;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = target[segments[i]];
    if (next === null || typeof next !== "object") return;
    target = next as Record<string, unknown>;
  }
  delete target[segments[segments.length - 1]];
}

function applyUpdate(doc: Doc, update: Doc, positional: Record<string, number>, isInsert: boolean) {
  for (const [operator, payload] of Object.entries(update)) {
    const fields = payload as Doc;

    switch (operator) {
      case "$set":
        for (const [path, value] of Object.entries(fields)) {
          setPath(doc, path, clone(value), positional);
        }
        break;

      case "$setOnInsert":
        if (isInsert) {
          for (const [path, value] of Object.entries(fields)) {
            setPath(doc, path, clone(value), positional);
          }
        }
        break;

      case "$inc":
        for (const [path, delta] of Object.entries(fields)) {
          const resolved = path.replace(/\.\$\./, (match, offset: number) => {
            const field = path.slice(0, offset);
            return `.${positional[field]}.`;
          });
          const current = getPath(doc, resolved);
          setPath(
            doc,
            resolved,
            (typeof current === "number" ? current : 0) + (delta as number),
            positional
          );
        }
        break;

      case "$push":
        for (const [path, value] of Object.entries(fields)) {
          const current = getPath(doc, path);
          const list = Array.isArray(current) ? [...current] : [];
          list.push(clone(value));
          setPath(doc, path, list, positional);
        }
        break;

      case "$pull":
        for (const [path, criteria] of Object.entries(fields)) {
          const current = getPath(doc, path);
          if (!Array.isArray(current)) break;
          setPath(
            doc,
            path,
            current.filter(
              (entry) => !matchesFilter(entry as Doc, criteria as Doc).ok
            ),
            positional
          );
        }
        break;

      case "$unset":
        for (const path of Object.keys(fields)) {
          unsetPath(doc, path);
        }
        break;

      default:
        throw new Error(`mongo-double: unsupported update operator ${operator}`);
    }
  }
}

class FakeCursor {
  constructor(private docs: Doc[]) {}

  sort(spec: Record<string, 1 | -1>) {
    const entries = Object.entries(spec);
    this.docs = [...this.docs].sort((a, b) => {
      for (const [field, direction] of entries) {
        const left = getPath(a, field);
        const right = getPath(b, field);
        if (left === right) continue;
        const comparison =
          typeof left === "string" && typeof right === "string"
            ? left.localeCompare(right)
            : Number(left ?? 0) - Number(right ?? 0);
        if (comparison !== 0) return comparison * direction;
      }
      return 0;
    });
    return this;
  }

  limit(count: number) {
    this.docs = this.docs.slice(0, count);
    return this;
  }

  async toArray() {
    return this.docs.map((doc) => clone(doc));
  }
}

let idCounter = 0;

class FakeCollection {
  docs: Doc[] = [];

  constructor(private name: string) {}

  private uniqueKey(): string | undefined {
    return UNIQUE_KEYS[this.name];
  }

  private assertUnique(candidate: Doc, ignore?: Doc) {
    const key = this.uniqueKey();
    if (!key) return;
    const value = candidate[key];
    if (value === undefined) return;
    const clash = this.docs.some(
      (doc) => doc !== ignore && deepEqual(doc[key], value)
    );
    if (clash) throw duplicateKeyError(this.name, key);
  }

  private find_(filter: Doc): { doc: Doc; positional: Record<string, number> } | null {
    for (const doc of this.docs) {
      const match = matchesFilter(doc, filter);
      if (match.ok) return { doc, positional: match.positional };
    }
    return null;
  }

  async findOne(filter: Doc = {}) {
    return clone(this.find_(filter)?.doc ?? null);
  }

  find(filter: Doc = {}) {
    return new FakeCursor(
      this.docs.filter((doc) => matchesFilter(doc, filter).ok)
    );
  }

  async countDocuments(filter: Doc = {}) {
    return this.docs.filter((doc) => matchesFilter(doc, filter).ok).length;
  }

  async insertOne(doc: Doc) {
    const stored = clone(doc);
    if (stored._id === undefined) stored._id = `id_${++idCounter}`;
    this.assertUnique(stored);
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }

  async updateOne(filter: Doc, update: Doc, options: { upsert?: boolean } = {}) {
    const found = this.find_(filter);

    if (!found) {
      if (!options.upsert) {
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: null };
      }
      const created = this.upsertDoc(filter, update);
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedId: created._id,
      };
    }

    const before = JSON.stringify(found.doc);
    applyUpdate(found.doc, update, found.positional, false);
    this.assertUnique(found.doc, found.doc);
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: JSON.stringify(found.doc) === before ? 0 : 1,
      upsertedId: null,
    };
  }

  private upsertDoc(filter: Doc, update: Doc): Doc {
    // Equality fields in the filter seed the new document, as MongoDB does.
    const seed: Doc = {};
    for (const [field, condition] of Object.entries(filter)) {
      if (!field.includes(".") && !isOperatorObject(condition)) {
        seed[field] = clone(condition);
      }
    }
    // An _id supplied by the filter wins: the rate limiter upserts by a
    // composed _id and then reads the counter back by that same key.
    if (seed._id === undefined) seed._id = `id_${++idCounter}`;
    applyUpdate(seed, update, {}, true);
    this.assertUnique(seed);
    this.docs.push(seed);
    return seed;
  }

  async findOneAndUpdate(
    filter: Doc,
    update: Doc,
    options: { upsert?: boolean; returnDocument?: "before" | "after" } = {}
  ) {
    const found = this.find_(filter);

    if (!found) {
      if (!options.upsert) return null;
      const created = this.upsertDoc(filter, update);
      return options.returnDocument === "before" ? null : clone(created);
    }

    const before = clone(found.doc);
    applyUpdate(found.doc, update, found.positional, false);
    return options.returnDocument === "before" ? before : clone(found.doc);
  }

  async deleteOne(filter: Doc) {
    const found = this.find_(filter);
    if (!found) return { acknowledged: true, deletedCount: 0 };
    this.docs = this.docs.filter((doc) => doc !== found.doc);
    return { acknowledged: true, deletedCount: 1 };
  }

  async deleteMany(filter: Doc = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !matchesFilter(doc, filter).ok);
    return { acknowledged: true, deletedCount: before - this.docs.length };
  }

  async createIndex() {
    return "ok";
  }
}

export class FakeDb {
  private collections = new Map<string, FakeCollection>();

  collection(name: string): FakeCollection {
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new FakeCollection(name);
      this.collections.set(name, collection);
    }
    return collection;
  }

  /** Replace a collection's contents. */
  seed(name: string, docs: Doc[]) {
    const collection = this.collection(name);
    collection.docs = docs.map((doc) => {
      const stored = clone(doc);
      if (stored._id === undefined) stored._id = `id_${++idCounter}`;
      return stored;
    });
  }

  /** Raw contents, for asserting on what a handler persisted. */
  all(name: string): Doc[] {
    return this.collection(name).docs.map((doc) => clone(doc));
  }

  reset() {
    this.collections.clear();
  }
}

/**
 * The single database every test module shares. Route modules capture
 * `connectToDB` at import time, so the instance has to be stable; `reset()`
 * clears it between tests instead.
 */
export const testDb = new FakeDb();

/** Matches the shape of `connectToDB`, for `vi.mock("@/app/api/db", …)`. */
export async function connectToTestDB() {
  return { client: {} as never, db: testDb as never };
}
