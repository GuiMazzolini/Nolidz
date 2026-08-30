import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { getT } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.forgotPassword.metaTitle,
    description: t.forgotPassword.metaDescription,
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
