import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getAccountProfile } from "@/app/lib/account";
import AccountSections from "./AccountSections";
import { getI18n } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.account.metaTitle,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { t, path } = await getI18n();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect(path("/login?callbackUrl=/account"));
  }

  const profile = await getAccountProfile(session.user.email);

  // A session can outlive its user record — the account was deleted in another
  // tab, or predates the signIn upsert that now persists OAuth users.
  if (!profile) {
    // The route handler itself is not localised, but where it sends them is.
    redirect(`/api/auth/signout?callbackUrl=${encodeURIComponent(path("/"))}`);
  }

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {t.account.heading}
        </h1>
        <p className="text-gray-600 mb-8">{t.account.intro}</p>
        <AccountSections profile={profile} />
      </div>
    </div>
  );
}
