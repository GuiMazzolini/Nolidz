"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminT } from "@/app/i18n/client";

export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(t.products.deleteConfirm(productName))) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(
          typeof data.error === "string" ? data.error : t.products.deleteFailed
        );
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {loading ? "…" : t.products.delete}
    </button>
  );
}
