"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@/app/lib/categories";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";
import {
  EU_SIZES,
  MAX_PRODUCT_VARIANTS,
  listColors,
  normalizeColorImage,
  variantComboKey,
  type ColorImageInput,
  type ProductVariant,
} from "@/app/lib/variants";
import { useAdminT, useLocalePath, useT } from "@/app/i18n/client";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  stock: number;
  category?: ProductCategory;
  variants?: ProductVariant[];
  colorImages?: ColorImageInput[];
  images?: string[];
};

type FieldErrors = {
  name?: string;
  description?: string;
  variants?: string;
  images?: string;
};

/** Stock is a string while editing so the input can be cleared. */
type VariantRow = {
  /**
   * Client-only identity for the React key. It cannot be derived from size and
   * colour: those are the fields being edited, and a key that changes on each
   * keystroke remounts the input and drops focus mid-word.
   */
  uid: string;
  sku?: string;
  size: string;
  color: string;
  stock: string;
};

let rowCounter = 0;
function nextUid(): string {
  return `row-${++rowCounter}`;
}

function toRows(variants: ProductVariant[] | undefined): VariantRow[] {
  return (variants ?? []).map((v) => ({
    uid: nextUid(),
    sku: v.sku,
    size: v.size,
    color: v.color,
    stock: String(v.stock),
  }));
}

export default function ProductForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ProductFormValues;
}) {
  const t = useAdminT();
  const storefront = useT();
  const localePath = useLocalePath();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<ProductCategory>(
    initial?.category ?? "men"
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * Optional shared extras (sole, box). Colour shoots live on each colour card;
   * these are appended after every colour's own photos on the storefront.
   */
  const [galleryImages, setGalleryImages] = useState<string[]>(
    () => initial?.images ?? []
  );

  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    toRows(initial?.variants)
  );
  const [runColor, setRunColor] = useState("");
  const [runStock, setRunStock] = useState("3");

  /**
   * Legacy single-SKU edits still have a product-level photo/price. The first
   * time a colour is stocked, seed that colour from those so the admin is not
   * forced to re-upload.
   */
  const legacySeed =
    mode === "edit" && !(initial?.variants?.length)
      ? {
          imageUrl: initial?.imageUrl?.trim() || "",
          price:
            typeof initial?.price === "number" && Number.isFinite(initial.price)
              ? String(initial.price)
              : "",
        }
      : null;

  const [colorPhotos, setColorPhotos] = useState<Record<string, string[]>>(
    () => {
      const out: Record<string, string[]> = {};
      for (const entry of initial?.colorImages ?? []) {
        const normalized = normalizeColorImage(entry);
        if (normalized) out[normalized.color] = [...normalized.imageUrls];
      }
      return out;
    }
  );
  const [colorPrices, setColorPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const variant of initial?.variants ?? []) {
      if (out[variant.color] !== undefined) continue;
      if (typeof variant.price === "number" && Number.isFinite(variant.price)) {
        out[variant.color] = String(variant.price);
      }
    }
    return out;
  });

  const variantColors = useMemo(
    () =>
      listColors(
        variantRows
          .filter((row) => row.color.trim())
          .map((row) => ({
            sku: "",
            size: row.size,
            color: row.color.trim(),
            stock: 0,
          }))
      ),
    [variantRows]
  );

  const variantStockTotal = useMemo(
    () =>
      variantRows.reduce((sum, row) => {
        const value = Number(row.stock);
        return sum + (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
      }, 0),
    [variantRows]
  );

  const filledGallery = useMemo(
    () => galleryImages.map((url) => url.trim()).filter(Boolean),
    [galleryImages]
  );

  function filledColorPhotos(color: string): string[] {
    return (colorPhotos[color] ?? []).map((url) => url.trim()).filter(Boolean);
  }

  function seedColourFromLegacy(color: string) {
    if (!legacySeed) return;
    setColorPhotos((prev) => {
      if ((prev[color]?.length ?? 0) > 0) return prev;
      if (!legacySeed.imageUrl.startsWith("http")) return prev;
      return { ...prev, [color]: [legacySeed.imageUrl] };
    });
    setColorPrices((prev) => {
      if (prev[color]?.trim()) return prev;
      if (!legacySeed.price) return prev;
      return { ...prev, [color]: legacySeed.price };
    });
  }

  function updateGalleryImage(index: number, value: string) {
    setFieldErrors((prev) => ({ ...prev, images: undefined }));
    setGalleryImages((urls) => urls.map((url, i) => (i === index ? value : url)));
  }

  function removeGalleryImage(index: number) {
    setFieldErrors((prev) => ({ ...prev, images: undefined }));
    setGalleryImages((urls) => urls.filter((_, i) => i !== index));
  }

  function addGallerySlot() {
    setFieldErrors((prev) => ({ ...prev, images: undefined }));
    setGalleryImages((urls) =>
      urls.length >= MAX_PRODUCT_IMAGES ? urls : [...urls, ""]
    );
  }

  function moveGalleryImage(index: number, delta: number) {
    setGalleryImages((urls) => {
      const target = index + delta;
      if (target < 0 || target >= urls.length) return urls;
      const next = [...urls];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateColorPhoto(color: string, index: number, value: string) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    setColorPhotos((prev) => {
      const urls = [...(prev[color] ?? [])];
      urls[index] = value;
      return { ...prev, [color]: urls };
    });
  }

  function removeColorPhoto(color: string, index: number) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    setColorPhotos((prev) => ({
      ...prev,
      [color]: (prev[color] ?? []).filter((_, i) => i !== index),
    }));
  }

  function addColorPhotoSlot(color: string) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    setColorPhotos((prev) => {
      const urls = prev[color] ?? [];
      if (urls.length >= MAX_PRODUCT_IMAGES) return prev;
      return { ...prev, [color]: [...urls, ""] };
    });
  }

  function moveColorPhoto(color: string, index: number, delta: number) {
    setColorPhotos((prev) => {
      const urls = [...(prev[color] ?? [])];
      const target = index + delta;
      if (target < 0 || target >= urls.length) return prev;
      [urls[index], urls[target]] = [urls[target], urls[index]];
      return { ...prev, [color]: urls };
    });
  }

  function updateRow(index: number, patch: Partial<VariantRow>) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    setVariantRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeRow(index: number) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    setVariantRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addRow(size: string, color: string, stock: string) {
    setFieldErrors((prev) => ({ ...prev, variants: undefined }));
    const trimmed = color.trim();
    seedColourFromLegacy(trimmed);
    setVariantRows((rows) => {
      if (rows.length >= MAX_PRODUCT_VARIANTS) return rows;
      const existing = rows.findIndex(
        (row) =>
          variantComboKey(row.size, row.color) === variantComboKey(size, trimmed)
      );
      if (existing >= 0) {
        return rows.filter((_, i) => i !== existing);
      }
      return [...rows, { uid: nextUid(), size, color: trimmed, stock }];
    });
  }

  function validateGallery(): string | undefined {
    if (filledGallery.length > MAX_PRODUCT_IMAGES) {
      return t.form.errors.tooManyPhotos(MAX_PRODUCT_IMAGES);
    }
    if (filledGallery.some((url) => !url.startsWith("http"))) {
      return t.form.errors.photoUrlInvalid;
    }
    return undefined;
  }

  function validateVariants(): string | undefined {
    if (variantRows.length === 0) {
      return t.form.errors.noVariants;
    }
    if (variantRows.length > MAX_PRODUCT_VARIANTS) {
      return t.form.errors.tooManyVariants(MAX_PRODUCT_VARIANTS);
    }

    const combos = new Set<string>();
    for (const row of variantRows) {
      if (!row.size.trim()) return t.form.errors.variantNeedsSize;
      if (!row.color.trim()) return t.form.errors.variantNeedsColour;

      const stockNum = Number(row.stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return t.form.errors.variantStockInvalid(row.size, row.color);
      }

      const combo = variantComboKey(row.size, row.color);
      if (combos.has(combo)) {
        return t.form.errors.variantDuplicate(row.size, row.color);
      }
      combos.add(combo);
    }

    for (const color of variantColors) {
      const raw = colorPrices[color];
      if (raw === undefined || raw.trim() === "") {
        return t.form.errors.colourPriceRequired(color);
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return t.form.errors.colourPriceInvalid(color);
      }

      const urls = filledColorPhotos(color);
      if (urls.length === 0) {
        return t.form.errors.colourPhotoRequired(color);
      }
      if (urls.length > MAX_PRODUCT_IMAGES) {
        return t.form.errors.tooManyColourPhotos(color, MAX_PRODUCT_IMAGES);
      }
      if (urls.some((url) => !url.startsWith("http"))) {
        return t.form.errors.colourPhotoUrlInvalid(color);
      }
    }
    return undefined;
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t.form.errors.nameRequired;
    if (!description.trim()) next.description = t.form.errors.descriptionRequired;
    next.images = validateGallery();
    next.variants = validateVariants();
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined)
    ) as FieldErrors;
  }

  async function uploadToCloudinary(
    file: File,
    onUploaded: (url: string) => void,
    errorField: "variants" | "images" = "variants"
  ) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, [errorField]: undefined }));
    setUploading(true);

    try {
      const signRes = await fetch("/api/admin/uploads/sign", {
        method: "POST",
        credentials: "include",
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(
          typeof signData.error === "string"
            ? signData.error
            : t.form.errors.uploadStartFailed
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", signData.timestamp);
      formData.append("folder", signData.folder);
      formData.append("signature", signData.signature);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || typeof uploadData.secure_url !== "string") {
        setFieldErrors((prev) => ({
          ...prev,
          [errorField]: t.form.errors.uploadFailed,
        }));
        return;
      }

      onUploaded(uploadData.secure_url);
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        [errorField]: t.form.errors.uploadNetwork,
      }));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(t.form.errors.fixHighlighted);
      return;
    }

    setLoading(true);

    const firstColor = variantColors[0];
    const firstPhotos = filledColorPhotos(firstColor);
    const firstPrice = Number(colorPrices[firstColor]);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      // Derived for cart / OG / admin thumbnails — shoppers see colour photos.
      imageUrl: firstPhotos[0],
      price: firstPrice,
      category,
      images: filledGallery,
      colorImages: variantColors.map((color) => ({
        color,
        imageUrls: filledColorPhotos(color),
      })),
      variants: variantRows.map((row) => {
        const colour = row.color.trim();
        return {
          ...(row.sku ? { sku: row.sku } : {}),
          size: row.size.trim(),
          color: colour,
          stock: Number(row.stock),
          price: Number(colorPrices[colour]),
        };
      }),
      ...(mode === "create" && id.trim() ? { id: id.trim() } : {}),
    };

    try {
      const res = await fetch(
        mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : t.form.errors.saveFailed
        );
        return;
      }
      router.push(localePath("/admin/products"));
      router.refresh();
    } catch {
      setError(t.form.errors.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-5 border-2 border-ink/10 bg-white p-6"
      noValidate
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink/80">
          {t.form.name}
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
          required
          aria-invalid={!!fieldErrors.name}
          className={`w-full border-2 px-3 py-2 ${
            fieldErrors.name ? "border-red-400" : "border-ink/15"
          }`}
        />
        {fieldErrors.name && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      {mode === "create" && (
        <div>
          <label htmlFor="id" className="mb-1 block text-sm font-medium text-ink/80">
            {t.form.idOptional}
          </label>
          <input
            id="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t.form.idPlaceholder}
            className="w-full border-2 border-ink/15 px-3 py-2"
          />
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-ink/80">
          {t.form.category}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {PRODUCT_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`border-2 py-2 text-sm font-semibold transition-colors ${
                category === option
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 text-ink/80 hover:border-cardboard-dark"
              }`}
            >
              {storefront.nav[option]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-ink/80"
        >
          {t.form.description}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
          required
          rows={4}
          aria-invalid={!!fieldErrors.description}
          className={`w-full border-2 px-3 py-2 ${
            fieldErrors.description ? "border-red-400" : "border-ink/15"
          }`}
        />
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>
        )}
      </div>

      <fieldset className="border-2 border-ink/10 p-4">
        <legend className="px-1 text-sm font-medium text-ink/80">
          {t.form.variantsLegend}
        </legend>
        <p className="mb-4 text-xs text-ink/45">{t.form.variantsIntro}</p>

        {legacySeed && variantRows.length === 0 && (
          <p className="mb-4 border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t.form.legacySingleSkuHint}
          </p>
        )}

        <div className="space-y-5">
          <div className="border-2 border-ink/10 bg-paper p-3">
            <p className="mb-2 text-sm font-medium text-ink/80">
              {t.form.addSizeRun}
            </p>
            <p className="mb-2 text-xs text-ink/45">{t.form.addSizeRunHint}</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink/60">
                  {t.form.colour}
                </span>
                <input
                  value={runColor}
                  onChange={(e) => setRunColor(e.target.value)}
                  placeholder={t.form.colourPlaceholder}
                  className="w-44 border-2 border-ink/15 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink/60">
                  {t.form.stockPerSize}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={runStock}
                  onChange={(e) => setRunStock(e.target.value)}
                  className="w-28 border-2 border-ink/15 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {EU_SIZES.map((size) => {
                const active = variantRows.some(
                  (row) =>
                    variantComboKey(row.size, row.color) ===
                    variantComboKey(size, runColor)
                );
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={!runColor.trim()}
                    onClick={() => addRow(size, runColor.trim(), runStock || "0")}
                    className={`border-2 px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/15 bg-white text-ink/80 hover:border-cardboard-dark"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink/45">
              {runColor.trim()
                ? t.form.tapSizeHint
                : t.form.enterColourFirst}
            </p>
          </div>

          {variantRows.length > 0 && (
            <>
              <div className="border-2 border-ink/10 bg-paper px-3 py-2 text-sm text-ink/60">
                {t.form.variantStockSummary(
                  variantStockTotal,
                  variantRows.length
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-ink/45">
                    <tr>
                      <th className="py-2 pr-3 font-medium">{t.form.euSize}</th>
                      <th className="py-2 pr-3 font-medium">{t.form.colour}</th>
                      <th className="py-2 pr-3 font-medium">{t.form.stock}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {variantRows.map((row, index) => (
                      <tr key={row.uid}>
                        <td className="py-2 pr-3">
                          <input
                            value={row.size}
                            onChange={(e) =>
                              updateRow(index, { size: e.target.value })
                            }
                            aria-label={t.form.euSizeForRow(index + 1)}
                            className="w-20 border-2 border-ink/15 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={row.color}
                            onChange={(e) =>
                              updateRow(index, { color: e.target.value })
                            }
                            aria-label={t.form.colourForRow(index + 1)}
                            className="w-40 border-2 border-ink/15 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.stock}
                            onChange={(e) =>
                              updateRow(index, { stock: e.target.value })
                            }
                            aria-label={t.form.stockForRow(index + 1)}
                            className="w-24 border-2 border-ink/15 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            {t.form.remove}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {variantColors.length > 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-ink/80">
                  {t.form.colourPhotosAndPrices}
                </p>
                <p className="mt-0.5 text-xs text-ink/45">
                  {t.form.colourPhotosHint(MAX_PRODUCT_IMAGES)}
                </p>
              </div>

              {variantColors.map((color) => {
                const urls = colorPhotos[color] ?? [];
                const preview = filledColorPhotos(color)[0] ?? "";
                return (
                  <div
                    key={color}
                    className="space-y-3 border-2 border-ink/10 bg-paper p-3"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-ink/10 bg-white">
                        {preview.startsWith("http") && (
                          /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                          <img
                            src={preview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {color}
                      </span>
                      <label className="block">
                        <span className="mb-1 block text-xs text-ink/60">
                          {t.form.price}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={colorPrices[color] ?? ""}
                          onChange={(e) =>
                            setColorPrices((prev) => ({
                              ...prev,
                              [color]: e.target.value,
                            }))
                          }
                          aria-label={t.form.priceFor(color)}
                          placeholder="0.00"
                          className="w-28 border-2 border-ink/15 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>

                    {urls.length > 0 && (
                      <div className="space-y-2">
                        {urls.map((url, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-ink/10 bg-white">
                              {url.trim().startsWith("http") && (
                                /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                                <img
                                  src={url.trim()}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                            <input
                              value={url}
                              onChange={(e) =>
                                updateColorPhoto(color, index, e.target.value)
                              }
                              placeholder={t.form.photoUrlPlaceholder}
                              aria-label={t.form.photoUrlFor(color, index + 1)}
                              className="w-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm"
                            />
                            <label className="shrink-0 cursor-pointer border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-paper">
                              {t.form.upload}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    void uploadToCloudinary(file, (uploaded) =>
                                      updateColorPhoto(color, index, uploaded)
                                    );
                                  }
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => moveColorPhoto(color, index, -1)}
                              disabled={index === 0}
                              aria-label={t.form.movePhotoUp(index + 1)}
                              className="shrink-0 border-2 border-ink/15 bg-white px-2 py-1.5 text-xs text-ink/80 hover:bg-paper disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveColorPhoto(color, index, 1)}
                              disabled={index === urls.length - 1}
                              aria-label={t.form.movePhotoDown(index + 1)}
                              className="shrink-0 border-2 border-ink/15 bg-white px-2 py-1.5 text-xs text-ink/80 hover:bg-paper disabled:opacity-40"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeColorPhoto(color, index)}
                              className="shrink-0 text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              {t.form.remove}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => addColorPhotoSlot(color)}
                      disabled={urls.length >= MAX_PRODUCT_IMAGES}
                      className="border-2 border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper disabled:opacity-40"
                    >
                      {t.form.addColourPhoto(color)}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              setVariantRows((rows) =>
                rows.length >= MAX_PRODUCT_VARIANTS
                  ? rows
                  : [
                      ...rows,
                      {
                        uid: nextUid(),
                        size: "",
                        color: runColor.trim(),
                        stock: "0",
                      },
                    ]
              )
            }
            className="border-2 border-ink/15 px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper"
          >
            {t.form.addEmptyRow}
          </button>

          {fieldErrors.variants && (
            <p className="text-sm text-red-600">{fieldErrors.variants}</p>
          )}
        </div>
      </fieldset>

      <fieldset className="border-2 border-ink/10 p-4">
        <legend className="px-1 text-sm font-medium text-ink/80">
          {t.form.morePhotos}
        </legend>
        <p className="mb-3 text-xs text-ink/45">
          {t.form.morePhotosHint(MAX_PRODUCT_IMAGES)}
        </p>

        {galleryImages.length > 0 && (
          <div className="mb-3 space-y-2">
            {galleryImages.map((url, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-ink/10 bg-paper">
                  {url.trim().startsWith("http") && (
                    /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                    <img
                      src={url.trim()}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <input
                  value={url}
                  onChange={(e) => updateGalleryImage(index, e.target.value)}
                  placeholder={t.form.cloudinaryPlaceholder}
                  aria-label={t.form.extraPhotoUrl(index + 1)}
                  className="w-full border-2 border-ink/15 px-3 py-1.5 text-sm"
                />

                <label className="shrink-0 cursor-pointer border-2 border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-paper">
                  {t.form.upload}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadToCloudinary(
                          file,
                          (uploaded) => updateGalleryImage(index, uploaded),
                          "images"
                        );
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => moveGalleryImage(index, -1)}
                  disabled={index === 0}
                  aria-label={t.form.movePhotoUp(index + 1)}
                  className="shrink-0 border-2 border-ink/15 px-2 py-1.5 text-xs text-ink/80 hover:bg-paper disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveGalleryImage(index, 1)}
                  disabled={index === galleryImages.length - 1}
                  aria-label={t.form.movePhotoDown(index + 1)}
                  className="shrink-0 border-2 border-ink/15 px-2 py-1.5 text-xs text-ink/80 hover:bg-paper disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeGalleryImage(index)}
                  className="shrink-0 text-sm font-medium text-red-600 hover:text-red-800"
                >
                  {t.form.remove}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addGallerySlot}
          disabled={galleryImages.length >= MAX_PRODUCT_IMAGES}
          className="border-2 border-ink/15 px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper disabled:opacity-40"
        >
          {t.form.addPhoto}
        </button>

        {fieldErrors.images && (
          <p className="mt-2 text-sm text-red-600">{fieldErrors.images}</p>
        )}
      </fieldset>

      {error && (
        <div
          className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-ink px-5 py-2.5 font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {loading
            ? t.common.saving
            : mode === "create"
              ? t.form.createProduct
              : t.form.saveChanges}
        </button>
        <button
          type="button"
          onClick={() => router.push(localePath("/admin/products"))}
          className="border-2 border-ink/15 bg-paper px-5 py-2.5 font-semibold text-ink hover:border-cardboard-dark"
        >
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
