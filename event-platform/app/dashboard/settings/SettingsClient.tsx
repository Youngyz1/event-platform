"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ModalPricing } from "@/components/ui/modal-pricing";

export type Prefs = {
  notify_ticket_purchase: boolean;
  notify_donation: boolean;
  notify_event_reminder: boolean;
};

type AddressInfo = {
  address: string;
  address2: string;
  city: string;
  country: string;
  zip: string;
  state: string;
};

export type AccountInfo = {
  prefix: string;
  firstName: string;
  lastName: string;
  suffix: string;
  homePhone: string;
  cellPhone: string;
  jobTitle: string;
  company: string;
  website: string;
  blog: string;
  homeAddress: AddressInfo;
  billingAddress: AddressInfo;
  shippingAddress: AddressInfo;
  workAddress: AddressInfo;
};

export const defaultAddress: AddressInfo = {
  address: "",
  address2: "",
  city: "",
  country: "United States",
  zip: "",
  state: "",
};

export const defaultAccountInfo: AccountInfo = {
  prefix: "",
  firstName: "",
  lastName: "",
  suffix: "",
  homePhone: "",
  cellPhone: "",
  jobTitle: "",
  company: "",
  website: "",
  blog: "",
  homeAddress: defaultAddress,
  billingAddress: defaultAddress,
  shippingAddress: defaultAddress,
  workAddress: defaultAddress,
};

type OrganizerInfo = { id: string; name: string } | null;
type AddressKey = "homeAddress" | "billingAddress" | "shippingAddress" | "workAddress";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:rounded-xl sm:px-4 sm:py-3";

const stateOptions = [
  "Alabama",
  "Alaska",
  "Arizona",
  "California",
  "Florida",
  "Georgia",
  "Illinois",
  "New Jersey",
  "New York",
  "Ohio",
  "Pennsylvania",
  "Texas",
  "Washington",
];

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-4 last:border-0 sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-bold text-zinc-900 sm:text-base">{label}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-zinc-500 sm:text-sm">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? "bg-orange-600" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function AddressFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: AddressInfo;
  onChange: (field: keyof AddressInfo, next: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
      <h3 className="text-lg font-black text-zinc-950">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Address">
          <input value={value.address} onChange={(e) => onChange("address", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Address 2">
          <input value={value.address2} onChange={(e) => onChange("address2", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="City">
          <input value={value.city} onChange={(e) => onChange("city", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Country">
          <select value={value.country} onChange={(e) => onChange("country", e.target.value)} className={fieldClass}>
            <option>United States</option>
            <option>Canada</option>
            <option>Nigeria</option>
            <option>United Kingdom</option>
          </select>
        </Field>
        <Field label="Zip/Postal Code">
          <input value={value.zip} onChange={(e) => onChange("zip", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="State">
          <select value={value.state} onChange={(e) => onChange("state", e.target.value)} className={fieldClass}>
            <option value="">Select a State</option>
            {stateOptions.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}

export default function SettingsClient({
  initialEmail,
  initialDisplayName,
  initialProfilePhoto,
  initialAccountInfo,
  initialPrefs,
  organizer,
  userId,
}: {
  initialEmail: string;
  initialDisplayName: string;
  initialProfilePhoto: string;
  initialAccountInfo: AccountInfo;
  initialPrefs: Prefs;
  organizer: OrganizerInfo;
  userId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profilePhoto, setProfilePhoto] = useState(initialProfilePhoto);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    ...defaultAccountInfo,
    ...initialAccountInfo,
    homeAddress: { ...defaultAddress, ...initialAccountInfo.homeAddress },
    billingAddress: { ...defaultAddress, ...initialAccountInfo.billingAddress },
    shippingAddress: { ...defaultAddress, ...initialAccountInfo.shippingAddress },
    workAddress: { ...defaultAddress, ...initialAccountInfo.workAddress },
  });
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function updateAccount(field: keyof Omit<AccountInfo, AddressKey>, value: string) {
    setAccountInfo((current) => ({ ...current, [field]: value }));
  }

  function updateAddress(section: AddressKey, field: keyof AddressInfo, value: string) {
    setAccountInfo((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function handlePhoto(file: File | null) {
    setPhotoFile(file);
    if (file) setProfilePhoto(URL.createObjectURL(file));
  }

  async function uploadProfilePhoto() {
    if (!photoFile) return profilePhoto;

    const ext = photoFile.name.split(".").pop() || "jpg";
    const fileName = `${userId}/profile-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, photoFile, { upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("profile-images").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setError("");

    try {
      const nextPhoto = await uploadProfilePhoto();
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
          account_info: accountInfo,
          profile_photo: nextPhoto || null,
        })
        .eq("id", userId);

      if (dbError) throw new Error(dbError.message);

      setDisplayName(nextDisplayName);
      setProfilePhoto(nextPhoto);
      showToast(email.trim() !== initialEmail ? "Account saved. Check your inbox to confirm the new email." : "Account information saved.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save account information.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setError("");
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ preferences: prefs })
      .eq("id", userId);
    setSavingPrefs(false);
    if (dbError) setError(dbError.message);
    else showToast("Notification preferences saved.");
  }

  async function sendPasswordReset() {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = appUrl ? `${appUrl}/reset-password` : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(initialEmail, {
      redirectTo,
    });
    if (resetError) setError(resetError.message);
    else showToast("Password reset email sent. Check your inbox.");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 sm:rounded-2xl sm:px-5">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:rounded-2xl sm:px-5">
          {error}
        </div>
      )}

      <form onSubmit={saveAccount} className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6 lg:p-8">
        <div className="flex flex-col gap-2 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-orange-600">Account</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">Account Information</h2>
          </div>
          <p className="text-sm font-semibold text-zinc-500">Private account details. Organizers are managed separately.</p>
        </div>

        <section className="mt-8">
          <h3 className="text-2xl font-black text-zinc-950">Profile Photo</h3>
          <div className="mt-4 grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-3">
              <input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} className="sr-only" />
              <div className="flex h-full min-h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-5 text-center">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile preview" className="h-24 w-24 rounded-full object-cover" />
                ) : (
                  <span className="text-5xl text-blue-600">○</span>
                )}
                <p className="mt-4 text-xl font-medium uppercase leading-tight text-blue-600">Add a profile image</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-zinc-500">Drag and drop or choose a file to upload</p>
              </div>
            </label>
            <div>
              <p className="text-sm font-black text-zinc-950">Choose Image To Upload</p>
              <p className="mt-2 text-sm text-zinc-500">{photoFile ? photoFile.name : "No file chosen"}</p>
              <label className="mt-4 inline-flex cursor-pointer rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                <input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} className="sr-only" />
                Upload a file
              </label>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-2xl font-black text-zinc-950">Contact Information</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Display Name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Prefix">
              <select value={accountInfo.prefix} onChange={(e) => updateAccount("prefix", e.target.value)} className={fieldClass}>
                <option value="">--</option>
                <option>Mr.</option>
                <option>Mrs.</option>
                <option>Ms.</option>
                <option>Dr.</option>
              </select>
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
            <Field label="Company / Organization">
              <input value={accountInfo.company} onChange={(e) => updateAccount("company", e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Website">
              <input value={accountInfo.website} onChange={(e) => updateAccount("website", e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Blog">
              <input value={accountInfo.blog} onChange={(e) => updateAccount("blog", e.target.value)} className={fieldClass} />
            </Field>
          </div>
        </section>

        <div className="mt-8 grid gap-5">
          <AddressFields title="Home Address" value={accountInfo.homeAddress} onChange={(field, value) => updateAddress("homeAddress", field, value)} />
          <AddressFields title="Billing Address" value={accountInfo.billingAddress} onChange={(field, value) => updateAddress("billingAddress", field, value)} />
          <AddressFields title="Shipping Address" value={accountInfo.shippingAddress} onChange={(field, value) => updateAddress("shippingAddress", field, value)} />
          <AddressFields title="Work Address" value={accountInfo.workAddress} onChange={(field, value) => updateAddress("workAddress", field, value)} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={savingAccount} className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60">
            {savingAccount ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={sendPasswordReset} className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50">
            Change Password
          </button>
        </div>
      </form>

      <form onSubmit={savePrefs} className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <h2 className="mb-4 text-sm font-black tracking-tight text-zinc-950 sm:mb-5 sm:text-base">Notification Preferences</h2>
        <Toggle
          checked={prefs.notify_ticket_purchase}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_ticket_purchase: v }))}
          label="Ticket Purchase Emails"
          description="Get an email whenever someone buys a ticket to one of your events."
        />
        <Toggle
          checked={prefs.notify_donation}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_donation: v }))}
          label="Donation Emails"
          description="Get an email whenever someone donates to one of your fundraisers."
        />
        <Toggle
          checked={prefs.notify_event_reminder}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_event_reminder: v }))}
          label="Event Reminder Emails"
          description="Receive reminder emails before your upcoming events."
        />
        <div className="mt-5">
          <button type="submit" disabled={savingPrefs} className="rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-60 sm:rounded-xl sm:px-5 sm:text-sm">
            {savingPrefs ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-sm font-black tracking-tight text-zinc-950 sm:text-base">Your Plan</h2>
            <p className="mt-1 text-[11px] leading-tight text-zinc-500 sm:text-sm">Upgrade to unlock unlimited events, fundraisers, and advanced analytics.</p>
          </div>
          <ModalPricing triggerLabel="Upgrade Plan" onConfirm={(id) => console.log("Plan selected:", id)} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <h2 className="mb-3 text-sm font-black tracking-tight text-zinc-950 sm:text-base">Organizer Profile</h2>
        {organizer ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-zinc-900 sm:text-base">{organizer.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500 sm:text-sm">Your public organizer profile.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a href={`/organizers/${organizer.id}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 hover:bg-zinc-50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm">
                View Profile
              </a>
              <a href="/create-organizer" className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white hover:bg-orange-700 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm">
                Edit Profile
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-zinc-500 sm:text-sm">You don&apos;t have an organizer profile yet.</p>
            <a href="/create-organizer" className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white hover:bg-orange-700 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm">
              Add Organizer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
