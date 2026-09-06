"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SettingsCard } from "@/components/ui/settings-card";
import ImageUploadWithCrop from "@/components/ui/ImageUploadWithCrop";
import { type AccountInfo, type AddressInfo, defaultAddress } from "@/types/settings";

const fieldClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold outline-hidden transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:rounded-xl sm:px-4 sm:py-2.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function ProfileClient({
  userId,
  initialEmail,
  initialDisplayName,
  initialProfilePhoto,
  initialAccountInfo,
  organizer,
}: {
  userId: string;
  initialEmail: string;
  initialDisplayName: string;
  initialProfilePhoto: string;
  initialAccountInfo: AccountInfo;
  organizer: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profilePhoto, setProfilePhoto] = useState(initialProfilePhoto);

  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    ...initialAccountInfo,
    homeAddress: { ...defaultAddress, ...initialAccountInfo.homeAddress },
    billingAddress: { ...defaultAddress, ...initialAccountInfo.billingAddress },
    shippingAddress: { ...defaultAddress, ...initialAccountInfo.shippingAddress },
    workAddress: { ...defaultAddress, ...initialAccountInfo.workAddress },
  });

  const [activeAddressTab, setActiveAddressTab] = useState<"home" | "billing" | "shipping" | "work">("home");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function updateAccount(field: keyof Omit<AccountInfo, "homeAddress" | "billingAddress" | "shippingAddress" | "workAddress">, value: string) {
    setAccountInfo((current) => ({ ...current, [field]: value }));
  }

  function updateAddress(section: "homeAddress" | "billingAddress" | "shippingAddress" | "workAddress", field: keyof AddressInfo, value: string) {
    setAccountInfo((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const nextPhoto = profilePhoto;
      const nextDisplayName =
        displayName.trim() ||
        [accountInfo.firstName, accountInfo.lastName].filter(Boolean).join(" ").trim();

      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: nextDisplayName },
      });
      if (authError) throw new Error(authError.message);

      if (email.trim() && email.trim() !== initialEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw new Error(emailError.message);
      }

      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          display_name: nextDisplayName,
          account_info: accountInfo,
          profile_photo: nextPhoto || null,
        })
        .eq("id", userId);

      if (dbError) throw new Error(dbError.message);

      setDisplayName(nextDisplayName);
      setProfilePhoto(nextPhoto);
      showToast(email.trim() !== initialEmail ? "Profile saved. Check your inbox to confirm the new email." : "Profile details saved successfully.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save profile details.");
    } finally {
      setSaving(false);
    }
  }

  const activeAddress = 
    activeAddressTab === "home" ? accountInfo.homeAddress :
    activeAddressTab === "billing" ? accountInfo.billingAddress :
    activeAddressTab === "shipping" ? accountInfo.shippingAddress :
    accountInfo.workAddress;

  const activeAddressKey = 
    activeAddressTab === "home" ? "homeAddress" as const :
    activeAddressTab === "billing" ? "billingAddress" as const :
    activeAddressTab === "shipping" ? "shippingAddress" as const :
    "workAddress" as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Profile Photo */}
      <SettingsCard
        title="Profile Photo"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 overflow-hidden shadow-inner">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-extrabold text-zinc-300 font-sans">?</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <ImageUploadWithCrop
                bucket="profile-images"
                folder={userId}
                aspectRatio={1}
                shape="round"
                maxOutputWidth={512}
                maxOutputHeight={512}
                onUploaded={setProfilePhoto}
                onError={setError}
                renderTrigger={({ open, uploading }) => (
                  <button
                    type="button"
                    onClick={open}
                    disabled={uploading}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Choose Photo"}
                  </button>
                )}
              />
              {profilePhoto && (
                <button
                  type="button"
                  onClick={() => setProfilePhoto("")}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Allowed formats: JPG, PNG, GIF. Max file size: 5MB.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Contact Details */}
      <SettingsCard
        title="Contact Information"      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Display Name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Email Address">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="First Name">
            <input value={accountInfo.firstName} onChange={(e) => updateAccount("firstName", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Last Name">
            <input value={accountInfo.lastName} onChange={(e) => updateAccount("lastName", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Suffix">
            <input value={accountInfo.suffix} onChange={(e) => updateAccount("suffix", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Home Phone">
            <input value={accountInfo.homePhone} onChange={(e) => updateAccount("homePhone", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Cell Phone">
            <input value={accountInfo.cellPhone} onChange={(e) => updateAccount("cellPhone", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Job Title">
            <input value={accountInfo.jobTitle} onChange={(e) => updateAccount("jobTitle", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Company Name">
            <input value={accountInfo.company} onChange={(e) => updateAccount("company", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Website URL">
            <input value={accountInfo.website} onChange={(e) => updateAccount("website", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Blog Link">
            <input value={accountInfo.blog} onChange={(e) => updateAccount("blog", e.target.value)} className={fieldClass} />
          </Field>
        </div>
      </SettingsCard>

      {/* Address Details */}
      <SettingsCard
        title="Addresses"
      >
        <div className="space-y-6">
          {/* Address Tabs */}
          <div className="flex overflow-x-auto border-b border-zinc-100">
            {(["home", "billing", "shipping", "work"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveAddressTab(tab)}
                className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-black capitalize transition-all duration-200 ${
                  activeAddressTab === tab
                    ? "text-brand-700 border-b-2 border-brand-600"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab} Address
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Street Address">
              <input
                value={activeAddress.address}
                onChange={(e) => updateAddress(activeAddressKey, "address", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Apartment, Suite, Unit, etc.">
              <input
                value={activeAddress.address2}
                onChange={(e) => updateAddress(activeAddressKey, "address2", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="City">
              <input
                value={activeAddress.city}
                onChange={(e) => updateAddress(activeAddressKey, "city", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Country">
              <input
                value={activeAddress.country}
                onChange={(e) => updateAddress(activeAddressKey, "country", e.target.value)}
                placeholder="Country"
                className={fieldClass}
              />
            </Field>
            <Field label="Zip / Postal Code">
              <input
                value={activeAddress.zip}
                onChange={(e) => updateAddress(activeAddressKey, "zip", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="State / Province">
              <input
                value={activeAddress.state}
                onChange={(e) => updateAddress(activeAddressKey, "state", e.target.value)}
                placeholder="State / Province"
                className={fieldClass}
              />
            </Field>
          </div>
        </div>
      </SettingsCard>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-black text-white hover:bg-brand-800 disabled:opacity-60 transition"
        >
          {saving ? "Saving Changes..." : "Save Profile Details"}
        </button>
      </div>
    </form>
  );
}
