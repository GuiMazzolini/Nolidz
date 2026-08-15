"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";
import {
  EU_SIZES,
  MAX_PRODUCT_VARIANTS,
  listColors,
  variantComboKey,
  type ColorImage,
  type ProductVariant,
} from "@/app/lib/variants";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  stock: number;
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
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [stock, setStock] = useState(initial?.stock?.toString() ?? "10");
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
    if (!name.trim()) next.name = "Name is required.";
    if (!description.trim()) next.description = "Description is required.";
    if (!imageUrl.trim().startsWith("http")) {
      next.imageUrl = "Upload an image or paste a Cloudinary URL (https://…).";
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      next.price = "Enter a valid non-negative price.";
    }
    next.images = validateGallery();

    if (useVariants) {
      next.variants = validateVariants();
    } else {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        next.stock = "Stock must be a whole number ≥ 0.";
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
      return `At most ${MAX_PRODUCT_IMAGES} extra photos.`;
    }
    if (filledGallery.some((url) => !url.startsWith("http"))) {
      return "Each extra photo needs a Cloudinary URL (https://…).";
    }
    return undefined;
  }

  function validateVariants(): string | undefined {
    if (variantRows.length === 0) {
      return "Add at least one size/colour, or turn variants off.";
    }
    if (variantRows.length > MAX_PRODUCT_VARIANTS) {
      return `At most ${MAX_PRODUCT_VARIANTS} variants.`;
    }

    const combos = new Set<string>();
    for (const row of variantRows) {
      if (!row.size.trim()) return "Every variant needs an EU size.";
      if (!row.color.trim()) return "Every variant needs a colour.";

      const stockNum = Number(row.stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return `Stock for EU ${row.size} / ${row.color} must be a whole number ≥ 0.`;
      }

      const combo = variantComboKey(row.size, row.color);
      if (combos.has(combo)) {
        return `EU ${row.size} / ${row.color} is listed twice.`;
      }
      combos.add(combo);
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
            : "Could not start image upload"
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
          [errorField]: "Image upload failed. Try another file.",
        }));
        return;
      }

      onUploaded(uploadData.secure_url);
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        [errorField]: "Image upload failed. Check your connection and try again.",
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
      setError("Please fix the highlighted fields before saving.");
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      price: Number(price),
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
            variants: variantRows.map((row) => ({
              ...(row.sku ? { sku: row.sku } : {}),
              size: row.size.trim(),
              color: row.color.trim(),
              stock: Number(row.stock),
            })),
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
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      noValidate
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          Name
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
          className={`w-full rounded-lg border px-3 py-2 ${
            fieldErrors.name ? "border-red-400" : "border-gray-300"
          }`}
        />
        {fieldErrors.name && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      {mode === "create" && (
        <div>
          <label htmlFor="id" className="mb-1 block text-sm font-medium text-gray-700">
            ID (optional)
          </label>
          <input
            id="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Auto-generated from name if empty"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Description
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
          className={`w-full rounded-lg border px-3 py-2 ${
            fieldErrors.description ? "border-red-400" : "border-gray-300"
          }`}
        />
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="imageUrl"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Product image
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
          placeholder="https://res.cloudinary.com/…"
          aria-invalid={!!fieldErrors.imageUrl}
          className={`w-full rounded-lg border px-3 py-2 ${
            fieldErrors.imageUrl ? "border-red-400" : "border-gray-300"
          }`}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {uploading ? "Uploading…" : "Upload image"}
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
          <p className="text-xs text-gray-500">
            Upload to Cloudinary, or paste a Cloudinary URL.
          </p>
        </div>
        {fieldErrors.imageUrl && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.imageUrl}</p>
        )}

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          {previewSrc ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */}
              <img
                key={previewSrc}
                src={previewSrc}
                alt={name || "Product preview"}
                className="h-28 w-28 shrink-0 rounded-lg object-cover bg-white ring-1 ring-gray-200"
                onError={() => setPreviewBroken(true)}
                onLoad={() => setPreviewBroken(false)}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Image preview</p>
                <p className="mt-1 truncate text-xs text-gray-500">{imageUrl}</p>
                {previewBroken && (
                  <p className="mt-2 text-sm text-red-600">
                    Couldn’t load this image — check the URL.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500">
              No image yet — upload one to see a preview
            </div>
          )}
        </div>
      </div>

      <fieldset className="rounded-xl border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          More photos
        </legend>
        <p className="mb-3 text-xs text-gray-500">
          Up to {MAX_PRODUCT_IMAGES} extra shots — profile, three-quarter, sole,
          detail. Shown after the main image, in this order.
        </p>

        {galleryImages.length > 0 && (
          <div className="mb-3 space-y-2">
            {galleryImages.map((url, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {url.trim().startsWith("http") && (
                    /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                    <img src={url.trim()} alt="" className="h-full w-full object-cover" />
                  )}
                </div>

                <input
                  value={url}
                  onChange={(e) => updateGalleryImage(index, e.target.value)}
                  placeholder="https://res.cloudinary.com/…"
                  aria-label={`Extra photo ${index + 1} URL`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />

                <label className="shrink-0 cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Upload
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
                  aria-label={`Move photo ${index + 1} up`}
                  className="shrink-0 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveGalleryImage(index, 1)}
                  disabled={index === galleryImages.length - 1}
                  aria-label={`Move photo ${index + 1} down`}
                  className="shrink-0 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeGalleryImage(index)}
                  className="shrink-0 text-sm font-medium text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addGallerySlot}
          disabled={galleryImages.length >= MAX_PRODUCT_IMAGES}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Add photo
        </button>

        {fieldErrors.images && (
          <p className="mt-2 text-sm text-red-600">{fieldErrors.images}</p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-gray-700">
            Price (USD)
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
            className={`w-full rounded-lg border px-3 py-2 ${
              fieldErrors.price ? "border-red-400" : "border-gray-300"
            }`}
          />
          {fieldErrors.price && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.price}</p>
          )}
        </div>
        <div>
          <label htmlFor="stock" className="mb-1 block text-sm font-medium text-gray-700">
            Stock
          </label>
          {useVariants ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {variantStockTotal} across {variantRows.length} variant
              {variantRows.length === 1 ? "" : "s"}
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
              className={`w-full rounded-lg border px-3 py-2 ${
                fieldErrors.stock ? "border-red-400" : "border-gray-300"
              }`}
            />
          )}
          {fieldErrors.stock && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.stock}</p>
          )}
        </div>
      </div>

      <fieldset className="rounded-xl border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Sizes &amp; colours
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
          <span className="text-sm text-gray-700">
            Sell this product by EU size and colour
            <span className="mt-0.5 block text-xs text-gray-500">
              Each size/colour combination gets its own SKU and stock count.
              Turning this off sells the product as a single SKU.
            </span>
          </span>
        </label>

        {useVariants && (
          <div className="mt-5 space-y-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Add a size run
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-600">Colour</span>
                  <input
                    value={runColor}
                    onChange={(e) => setRunColor(e.target.value)}
                    placeholder="e.g. Black"
                    className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-600">
                    Stock per size
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={runStock}
                    onChange={(e) => setRunStock(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                      className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {runColor.trim()
                  ? "Tap a size to add it for this colour; tap again to remove."
                  : "Enter a colour first, then tap the sizes you stock."}
              </p>
            </div>

            {variantRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">EU size</th>
                      <th className="py-2 pr-3 font-medium">Colour</th>
                      <th className="py-2 pr-3 font-medium">Stock</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variantRows.map((row, index) => (
                      <tr key={row.uid}>
                        <td className="py-2 pr-3">
                          <input
                            value={row.size}
                            onChange={(e) => updateRow(index, { size: e.target.value })}
                            aria-label={`EU size for row ${index + 1}`}
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={row.color}
                            onChange={(e) => updateRow(index, { color: e.target.value })}
                            aria-label={`Colour for row ${index + 1}`}
                            className="w-40 rounded-lg border border-gray-300 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.stock}
                            onChange={(e) => updateRow(index, { stock: e.target.value })}
                            aria-label={`Stock for row ${index + 1}`}
                            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {variantColors.length > 0 && (
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">Colour photos</p>
                <p className="mt-0.5 mb-3 text-xs text-gray-500">
                  Shown when a shopper hovers that colour on the catalog. Leave
                  one blank to fall back to the main product image.
                </p>

                <div className="space-y-2">
                  {variantColors.map((color) => (
                    <div key={color} className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                        {(colorPhotos[color] || imageUrl).startsWith("http") && (
                          /* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary remote URLs */
                          <img
                            src={colorPhotos[color] || imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <span className="w-32 shrink-0 truncate text-sm text-gray-700">
                        {color}
                      </span>

                      <input
                        value={colorPhotos[color] ?? ""}
                        onChange={(e) =>
                          setColorPhotos((prev) => ({
                            ...prev,
                            [color]: e.target.value,
                          }))
                        }
                        placeholder="https://res.cloudinary.com/… (optional)"
                        aria-label={`Photo URL for ${color}`}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />

                      <label className="shrink-0 cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        Upload
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add empty row
            </button>

            {fieldErrors.variants && (
              <p className="text-sm text-red-600">{fieldErrors.variants}</p>
            )}
          </div>
        )}
      </fieldset>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || uploading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="rounded-lg bg-gray-100 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
