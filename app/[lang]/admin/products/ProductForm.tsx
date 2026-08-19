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
  variantComboKey,
  type ColorImage,
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
  colorImages?: ColorImage[];
  images?: string[];
};

type FieldErrors = {
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  stock?: string;
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
  // Category names are shopper-facing wording, shared with the storefront nav.
  const storefront = useT();
  const localePath = useLocalePath();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [stock, setStock] = useState(initial?.stock?.toString() ?? "10");
  const [category, setCategory] = useState<ProductCategory>(
    initial?.category ?? "men"
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);

  /**
   * Extra gallery shots, in display order. Held as a plain array of URLs — a
   * blank row is a slot the admin has opened but not filled yet, and it is
   * dropped on submit rather than sent as an empty string.
   */
  const [galleryImages, setGalleryImages] = useState<string[]>(
    () => initial?.images ?? []
  );

  const [useVariants, setUseVariants] = useState(
    (initial?.variants?.length ?? 0) > 0
  );
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    toRows(initial?.variants)
  );
  // Size-run builder: pick a colour and a default count, then tap sizes.
  const [runColor, setRunColor] = useState("");
  const [runStock, setRunStock] = useState("3");

  /**
   * One photo per colourway, keyed by colour name so a row rename does not
   * strand the picture. Colours with no entry fall back to the main image.
   */
  const [colorPhotos, setColorPhotos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.colorImages ?? []).map((entry) => [entry.color, entry.imageUrl])
    )
  );
  /** Price per colourway. Empty means inherit the product price. */
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

  /** Colours currently present in the variant rows, in entry order. */
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

  /** Filled gallery entries, which is what the server is sent. */
  const filledGallery = useMemo(
    () => galleryImages.map((url) => url.trim()).filter(Boolean),
    [galleryImages]
  );

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

  /** Reorder by one slot; the gallery renders in array order. */
  function moveGalleryImage(index: number, delta: number) {
    setGalleryImages((urls) => {
      const target = index + delta;
      if (target < 0 || target >= urls.length) return urls;
      const next = [...urls];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
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
    setVariantRows((rows) => {
      if (rows.length >= MAX_PRODUCT_VARIANTS) return rows;
      // Tapping a size already in the run toggles it back off, so building a
      // size run stays a single row of clicks.
      const existing = rows.findIndex(
        (row) => variantComboKey(row.size, row.color) === variantComboKey(size, color)
      );
      if (existing >= 0) {
        return rows.filter((_, i) => i !== existing);
      }
      return [...rows, { uid: nextUid(), size, color, stock }];
    });
  }

  // Use the raw HTTPS URL for the admin preview so a bad transform
  // (or Next/Image quirks) never blank out the thumbnail.
  const previewSrc = useMemo(() => {
    const url = imageUrl.trim();
    return url.startsWith("http") ? url : null;
  }, [imageUrl]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t.form.errors.nameRequired;
    if (!description.trim()) next.description = t.form.errors.descriptionRequired;
    if (!imageUrl.trim().startsWith("http")) {
      next.imageUrl = t.form.errors.imageUrlInvalid;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      next.price = t.form.errors.priceInvalid;
    }
    next.images = validateGallery();

    if (useVariants) {
      next.variants = validateVariants();
    } else {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        next.stock = t.form.errors.stockInvalid;
      }
    }

    // Drop the keys we deliberately left undefined so the caller's
    // "any errors?" check stays a simple key count.
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined)
    ) as FieldErrors;
  }

  /**
   * Blank rows are ignored rather than rejected: opening a slot and changing
   * your mind is not an error, and submit drops them. MAX_PRODUCT_IMAGES is
   * the ceiling the ticket asked for (4–5 extra shots).
   */
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

    for (const color of [...new Set(variantRows.map((row) => row.color.trim()).filter(Boolean))]) {
      const raw = colorPrices[color];
      if (raw === undefined || raw.trim() === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return t.form.errors.colourPriceInvalid(color);
      }
    }
    return undefined;
  }

  async function uploadToCloudinary(
    file: File,
    onUploaded: (url: string) => void = setImageUrl,
    // Which field an upload failure is reported under, so a gallery upload does
    // not put its error message beside the main image input.
    errorField: "imageUrl" | "images" = "imageUrl"
  ) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, [errorField]: undefined }));
    setUploading(true);
    setPreviewBroken(false);

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

    const payload = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      price: Number(price),
      category,
      // Always sent: an empty array is how editing clears an existing gallery.
      images: filledGallery,
      ...(useVariants
        ? {
            // Only colours that still have a variant row, so removing a
            // colourway takes its photo with it.
            colorImages: variantColors
              .filter((color) => colorPhotos[color]?.trim())
              .map((color) => ({ color, imageUrl: colorPhotos[color].trim() })),
            // The server derives the product-level stock from these rows.
            variants: variantRows.map((row) => {
              const colour = row.color.trim();
              const colourPrice = Number(colorPrices[colour] || price);
              return {
                ...(row.sku ? { sku: row.sku } : {}),
                size: row.size.trim(),
                color: colour,
                stock: Number(row.stock),
                ...(Number.isFinite(colourPrice) ? { price: colourPrice } : {}),
              };
            }),
          }
        : {
            stock: Number(stock),
            // An empty array clears variants when editing a product that had
            // them; harmless on create.
            ...(mode === "edit" ? { variants: [], colorImages: [] } : {}),
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

      <div>
        <label
          htmlFor="imageUrl"
          className="mb-1 block text-sm font-medium text-ink/80"
        >
          {t.form.productImage}
        </label>
        <input
          id="imageUrl"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setPreviewBroken(false);
            setFieldErrors((prev) => ({ ...prev, imageUrl: undefined }));
          }}
          required
          placeholder={t.form.cloudinaryPlaceholder}
          aria-invalid={!!fieldErrors.imageUrl}
          className={`w-full border-2 px-3 py-2 ${
            fieldErrors.imageUrl ? "border-red-400" : "border-ink/15"
          }`}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center border-2 border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink/80 hover:bg-paper">
            {uploading ? t.form.uploading : t.form.uploadImage}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadToCloudinary(file);
                }
                e.currentTarget.value = "";
              }}
            />
          </label>
          <p className="text-xs text-ink/45">{t.form.uploadHint}</p>
        </div>
        {fieldErrors.imageUrl && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.imageUrl}</p>
        )}

        <div className="mt-4 border-2 border-ink/10 bg-paper p-3">
          {previewSrc ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */}
              <img
                key={previewSrc}
                src={previewSrc}
                alt={name || t.form.productPreview}
                className="h-28 w-28 shrink-0 object-cover bg-white ring-1 ring-ink/10"
                onError={() => setPreviewBroken(true)}
                onLoad={() => setPreviewBroken(false)}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {t.form.imagePreview}
                </p>
                <p className="mt-1 truncate text-xs text-ink/45">{imageUrl}</p>
                {previewBroken && (
                  <p className="mt-2 text-sm text-red-600">
                    {t.form.previewBroken}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center border border-dashed border-ink/20 bg-white text-sm text-ink/45">
              {t.form.noImageYet}
            </div>
          )}
        </div>
      </div>

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
                    <img src={url.trim()} alt="" className="h-full w-full object-cover" />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-ink/80">
            {t.form.price}
          </label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setFieldErrors((prev) => ({ ...prev, price: undefined }));
            }}
            required
            aria-invalid={!!fieldErrors.price}
            className={`w-full border-2 px-3 py-2 ${
              fieldErrors.price ? "border-red-400" : "border-ink/15"
            }`}
          />
          {fieldErrors.price && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.price}</p>
          )}
          {useVariants && (
            <p className="mt-1 text-xs text-ink/45">
              {t.form.priceFallbackHint}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="stock" className="mb-1 block text-sm font-medium text-ink/80">
            {t.form.stock}
          </label>
          {useVariants ? (
            <div className="border-2 border-ink/10 bg-paper px-3 py-2 text-sm text-ink/60">
              {t.form.variantStockSummary(variantStockTotal, variantRows.length)}
            </div>
          ) : (
            <input
              id="stock"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => {
                setStock(e.target.value);
                setFieldErrors((prev) => ({ ...prev, stock: undefined }));
              }}
              required
              aria-invalid={!!fieldErrors.stock}
              className={`w-full border-2 px-3 py-2 ${
                fieldErrors.stock ? "border-red-400" : "border-ink/15"
              }`}
            />
          )}
          {fieldErrors.stock && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.stock}</p>
          )}
        </div>
      </div>

      <fieldset className="border-2 border-ink/10 p-4">
        <legend className="px-1 text-sm font-medium text-ink/80">
          {t.form.variantsLegend}
        </legend>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={useVariants}
            onChange={(e) => {
              setUseVariants(e.target.checked);
              setFieldErrors((prev) => ({
                ...prev,
                stock: undefined,
                variants: undefined,
              }));
            }}
            className="mt-1"
          />
          <span className="text-sm text-ink/80">
            {t.form.useVariants}
            <span className="mt-0.5 block text-xs text-ink/45">
              {t.form.useVariantsHint}
            </span>
          </span>
        </label>

        {useVariants && (
          <div className="mt-5 space-y-5">
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
                    className="w-44 border-2 border-ink/15 px-3 py-2 text-sm"
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
                    className="w-28 border-2 border-ink/15 px-3 py-2 text-sm"
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
                            onChange={(e) => updateRow(index, { size: e.target.value })}
                            aria-label={t.form.euSizeForRow(index + 1)}
                            className="w-20 border-2 border-ink/15 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={row.color}
                            onChange={(e) => updateRow(index, { color: e.target.value })}
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
                            onChange={(e) => updateRow(index, { stock: e.target.value })}
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
            )}

            {variantColors.length > 0 && (
              <div className="border-2 border-ink/10 p-3">
                <p className="text-sm font-medium text-ink/80">
                  {t.form.colourPhotosAndPrices}
                </p>
                <p className="mt-0.5 mb-3 text-xs text-ink/45">
                  {t.form.colourPhotosHint}
                </p>

                <div className="space-y-2">
                  {variantColors.map((color) => (
                    <div key={color} className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-ink/10 bg-paper">
                        {(colorPhotos[color] || imageUrl).startsWith("http") && (
                          /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                          <img
                            src={colorPhotos[color] || imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <span className="w-28 shrink-0 truncate text-sm text-ink/80">
                        {color}
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={colorPrices[color] ?? price}
                        onChange={(e) =>
                          setColorPrices((prev) => ({
                            ...prev,
                            [color]: e.target.value,
                          }))
                        }
                        aria-label={t.form.priceFor(color)}
                        className="w-24 shrink-0 border-2 border-ink/15 px-2 py-1.5 text-sm"
                      />

                      <input
                        value={colorPhotos[color] ?? ""}
                        onChange={(e) =>
                          setColorPhotos((prev) => ({
                            ...prev,
                            [color]: e.target.value,
                          }))
                        }
                        placeholder={t.form.photoUrlPlaceholder}
                        aria-label={t.form.photoUrlFor(color)}
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
                              void uploadToCloudinary(file, (url) =>
                                setColorPhotos((prev) => ({ ...prev, [color]: url }))
                              );
                            }
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
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
                        { uid: nextUid(), size: "", color: runColor.trim(), stock: "0" },
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
