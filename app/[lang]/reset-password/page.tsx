import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";
import { getT } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.resetPassword.metaTitle,
    description: t.resetPassword.metaDescription,
  };
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="h-10 w-48 bg-ink/10 animate-pulse" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
