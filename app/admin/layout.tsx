import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { isAdminEmail } from "@/app/lib/admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/admin/orders");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink/10 bg-white">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-display font-semibold uppercase tracking-[0.2em] text-cardboard-dark">
              Admin
            </p>
            <h1 className="font-display italic font-extrabold text-xl text-ink tracking-tight">
              Shop management
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/orders"
              className="text-sm font-medium text-ink/60 hover:text-ink"
            >
              Orders
            </Link>
            <Link
              href="/admin/products"
              className="text-sm font-medium text-ink/60 hover:text-ink"
            >
              Products
            </Link>
            <Link
              href="/admin/products/new"
              className="bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/85"
            >
              Add product
            </Link>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
