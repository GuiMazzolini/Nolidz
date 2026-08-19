import { redirect } from "next/navigation";
import { getI18n } from "@/app/i18n/server";

export default async function AdminIndexPage() {
  const { path } = await getI18n();
  redirect(path("/admin/orders"));
}
