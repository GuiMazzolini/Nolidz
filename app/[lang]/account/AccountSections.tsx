"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { AccountProfile } from "@/app/lib/account";
import type { SavedAddress } from "@/app/lib/db-collections";
import { addressForForm, EMPTY_ADDRESS } from "@/app/lib/address";
import { useLocalePath, useT } from "@/app/i18n/client";

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const LABEL = "mb-1 block text-sm font-medium text-gray-700";
const PRIMARY =
  "rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:pointer-events-none";


function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        {success}
      </p>
    );
  }
  return null;
}

async function submit(
  url: string,
  method: string,
  body?: unknown,
  fallbackError = "Something went wrong"
) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : fallbackError);
  }
  return data;
}

export default function AccountSections({ profile }: { profile: AccountProfile }) {
  const [hasPassword, setHasPassword] = useState(profile.hasPassword);

  return (
    <div className="space-y-6">
      <ProfileSection profile={profile} />
      <PasswordSection hasPassword={hasPassword} onSet={() => setHasPassword(true)} />
      <AddressSection initial={profile.address} />
      <DangerSection />
    </div>
  );
}

function ProfileSection({ profile }: { profile: AccountProfile }) {
  const t = useT();
  const { update } = useSession();
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [state, setState] = useState<{ error?: string | null; success?: string | null }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({});
    setSaving(true);
    try {
      await submit(
        "/api/account/profile",
        "PATCH",
        { name: name.trim() },
        t.account.errorGeneric
      );
      // Push the new name into the JWT so the navbar updates without re-login.
      await update({ name: name.trim() });
      router.refresh();
      setState({ success: t.account.profileUpdated });
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : t.account.errorCouldNotSave,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t.account.profileTitle}
      description={t.account.profileDescription}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="acct-name" className={LABEL}>
            {t.account.displayName}
          </label>
          <input
            id="acct-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="acct-email" className={LABEL}>
            {t.account.emailLabel}
          </label>
          <input
            id="acct-email"
            value={profile.email}
            readOnly
            disabled
            className={`${INPUT} cursor-not-allowed bg-gray-50 text-gray-500`}
          />
          <p className="mt-1 text-xs text-gray-500">{t.account.emailLocked}</p>
        </div>

        <button type="submit" disabled={saving || !name.trim()} className={PRIMARY}>
          {saving ? t.common.saving : t.account.saveProfile}
        </button>
        <Feedback {...state} />
      </form>
    </Section>
  );
}

function PasswordSection({
  hasPassword,
  onSet,
}: {
  hasPassword: boolean;
  onSet: () => void;
}) {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ error?: string | null; success?: string | null }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({});

    if (next !== confirm) {
      setState({ error: t.account.passwordsDoNotMatch });
      return;
    }

    setSaving(true);
    try {
      await submit(
        "/api/account/password",
        "PUT",
        {
          ...(hasPassword ? { currentPassword: current } : {}),
          newPassword: next,
        },
        t.account.errorGeneric
      );
      setCurrent("");
      setNext("");
      setConfirm("");
      onSet();
      setState({
        success: hasPassword
          ? t.account.passwordChanged
          : t.account.passwordSet,
      });
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : t.account.errorCouldNotSave,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={hasPassword ? t.account.passwordTitle : t.account.passwordTitleSet}
      description={
        hasPassword
          ? t.account.passwordDescription
          : t.account.passwordDescriptionSet
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {hasPassword && (
          <div>
            <label htmlFor="acct-current" className={LABEL}>
              {t.account.currentPassword}
            </label>
            <input
              id="acct-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className={INPUT}
            />
          </div>
        )}

        <div>
          <label htmlFor="acct-new" className={LABEL}>
            {t.account.newPassword}
          </label>
          <input
            id="acct-new"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="acct-confirm" className={LABEL}>
            {t.account.confirmPassword}
          </label>
          <input
            id="acct-confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className={INPUT}
          />
        </div>

        <button type="submit" disabled={saving} className={PRIMARY}>
          {saving
            ? t.common.saving
            : hasPassword
              ? t.account.changePassword
              : t.account.setPassword}
        </button>
        <Feedback {...state} />
      </form>
    </Section>
  );
}

function AddressSection({ initial }: { initial: SavedAddress | null }) {
  const t = useT();
  const router = useRouter();
  const [address, setAddress] = useState<SavedAddress>(() =>
    addressForForm(initial)
  );
  // A dropped foreign address leaves an empty form for no visible reason, so
  // say why rather than letting it look like the save was lost.
  const droppedForeignAddress = Boolean(initial && !address.line1);
  const [state, setState] = useState<{ error?: string | null; success?: string | null }>({});
  const [saving, setSaving] = useState(false);

  function field(key: keyof SavedAddress) {
    return {
      value: address[key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setAddress((a) => ({ ...a, [key]: e.target.value })),
      className: INPUT,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({});
    setSaving(true);
    try {
      // Country is fixed to DE — Stripe Checkout only ships within Germany.
      await submit(
        "/api/account/address",
        "PUT",
        { ...address, country: "DE" },
        t.account.errorGeneric
      );
      router.refresh();
      setState({ success: t.account.addressSaved });
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : t.account.errorCouldNotSave,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    setState({});
    setSaving(true);
    try {
      await submit("/api/account/address", "DELETE", undefined, t.account.errorGeneric);
      setAddress({ ...EMPTY_ADDRESS });
      router.refresh();
      setState({ success: t.account.addressRemoved });
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : t.account.errorCouldNotRemove,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t.account.addressTitle}
      description={t.account.addressDescription}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {droppedForeignAddress && (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {t.account.addressDropped(t.common.shippingArea)}
          </p>
        )}
        <div>
          <label htmlFor="addr-line1" className={LABEL}>
            {t.account.line1}
          </label>
          <input id="addr-line1" required maxLength={200} {...field("line1")} />
        </div>
        <div>
          <label htmlFor="addr-line2" className={LABEL}>
            {t.account.line2}{" "}
            <span className="text-gray-400">({t.common.optional})</span>
          </label>
          <input id="addr-line2" maxLength={200} {...field("line2")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="addr-city" className={LABEL}>
              {t.account.city}
            </label>
            <input id="addr-city" required maxLength={100} {...field("city")} />
          </div>
          <div>
            <label htmlFor="addr-state" className={LABEL}>
              {t.account.state}{" "}
              <span className="text-gray-400">({t.common.optional})</span>
            </label>
            <input id="addr-state" maxLength={100} {...field("state")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="addr-postal" className={LABEL}>
              {t.account.postalCode}
            </label>
            <input id="addr-postal" required maxLength={20} {...field("postalCode")} />
          </div>
          <div>
            <label htmlFor="addr-country" className={LABEL}>
              {t.account.country}
            </label>
            <input
              id="addr-country"
              readOnly
              value={t.account.countryName}
              className={`${INPUT} bg-gray-50 text-gray-700`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className={PRIMARY}>
            {saving ? t.common.saving : t.account.saveAddress}
          </button>
          {initial && (
            <button
              type="button"
              onClick={onRemove}
              disabled={saving}
              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              {t.account.removeAddress}
            </button>
          )}
        </div>
        <Feedback {...state} />
      </form>
    </Section>
  );
}

function DangerSection() {
  const t = useT();
  const localePath = useLocalePath();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setError(null);
    setDeleting(true);
    try {
      await submit("/api/account", "DELETE", undefined, t.account.errorGeneric);
      await signOut({ callbackUrl: localePath("/") });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.account.errorCouldNotDelete
      );
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-red-700">
        {t.account.deleteTitle}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{t.account.deleteBody}</p>

      <div className="mt-5">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
          >
            {t.account.deleteCta}
          </button>
        ) : (
          <div className="space-y-3">
            {/* The word itself is translated — a German reader is asked to
                type LÖSCHEN, and the check below compares against the same
                dictionary entry, so the two cannot drift apart. */}
            <label htmlFor="confirm-delete" className={LABEL}>
              {t.account.deleteConfirmBefore}
              <span className="font-mono font-semibold">
                {t.account.deleteConfirmWord}
              </span>
              {t.account.deleteConfirmAfter}
            </label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={`${INPUT} max-w-xs`}
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onDelete}
                disabled={confirmText !== t.account.deleteConfirmWord || deleting}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {deleting ? t.account.deleting : t.account.deleteConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={deleting}
                className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {t.common.cancel}
              </button>
            </div>
            <Feedback error={error} />
          </div>
        )}
      </div>
    </section>
  );
}
