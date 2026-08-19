import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { getT } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.login.metaTitle,
    description: t.login.metaDescription,
  };
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="h-10 w-48 bg-ink/10 animate-pulse" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
