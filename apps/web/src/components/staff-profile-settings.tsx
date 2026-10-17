"use client";

import { CheckCircle2, Info, LoaderCircle, Lock, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";
import type { SessionUser } from "@/lib/session";

type Props = { user: Pick<SessionUser, "name" | "email" | "loginId" | "department" | "manager" | "profile"> & { roleName: string } };

const BLOOD_GROUPS = [["A_POSITIVE", "A+"], ["A_NEGATIVE", "A-"], ["B_POSITIVE", "B+"], ["B_NEGATIVE", "B-"], ["AB_POSITIVE", "AB+"], ["AB_NEGATIVE", "AB-"], ["O_POSITIVE", "O+"], ["O_NEGATIVE", "O-"]] as const;
const PLACEHOLDER_EMAIL = /@pending\.bondtherapy\.local$/i;
const PHONE = /^[0-9+() -]{7,20}$/;
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
const selectClass = "h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-background disabled:text-muted sm:h-10 sm:text-[13px]";
const inputClass = "text-base sm:text-sm";

function Heading({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="border-b pb-2"><h3 className="text-sm font-semibold text-foreground">{children}</h3>{hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}</div>;
}

function Fixed({ label, value }: { label: string; value: string }) {
  return <Field label={label}><Input value={value} readOnly className="bg-background text-muted" /></Field>;
}

export function StaffProfileSettings({ user }: Props) {
  if (!user.profile) return <NoRecord user={user} />;
  return <StaffDetailsForm user={{ ...user, profile: user.profile }} />;
}

// Accounts created outside Staff & Access have no employment record yet, so there is nothing for the staff member to fill in.
function NoRecord({ user }: Props) {
  return <div className="max-w-3xl"><section className="crm-surface">
    <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><UserRound size={18} /></span><div><h2 className="text-sm font-semibold text-foreground">My details</h2><p className="mt-0.5 text-xs text-muted">Your profile in the Bond Therapy staff record</p></div></div>
    <div className="space-y-5 p-5">
      <div className="flex items-start gap-3 rounded-lg border bg-brand-soft/50 px-4 py-3"><Info size={16} className="mt-0.5 shrink-0 text-brand" /><div><p className="text-[13px] font-semibold text-foreground">Your staff record is not set up yet</p><p className="mt-0.5 text-xs text-muted">Please ask an administrator to complete it. You will then be able to add your details here.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><Fixed label="Full name" value={user.name} /><Fixed label="Login ID" value={user.loginId} /><Fixed label="Role" value={user.roleName} />{user.manager && <Fixed label="Reporting manager" value={user.manager.name} />}</div>
    </div>
  </section></div>;
}

function StaffDetailsForm({ user }: { user: Props["user"] & { profile: NonNullable<SessionUser["profile"]> } }) {
  const router = useRouter();
  const { profile } = user;
  const locked = Boolean(profile.detailsSubmittedAt);
  const [form, setForm] = useState({
    mobile: profile.mobile ?? "",
    email: PLACEHOLDER_EMAIL.test(user.email) ? "" : user.email,
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
    bloodGroup: profile.bloodGroup ?? "",
    residentialAddress: profile.residentialAddress ?? "",
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactMobile: profile.emergencyContactMobile ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => { setForm((value) => ({ ...value, [key]: event.target.value })); setErrors((value) => ({ ...value, [key]: "" })); };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!PHONE.test(form.mobile.trim())) next.mobile = "Enter a valid mobile number.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.dateOfBirth || form.dateOfBirth > today) next.dateOfBirth = "Enter your date of birth.";
    if (form.residentialAddress.trim().length < 5) next.residentialAddress = "Enter your residential address.";
    if (form.emergencyContactName.trim().length < 2) next.emergencyContactName = "Enter the emergency contact name.";
    if (!PHONE.test(form.emergencyContactMobile.trim())) next.emergencyContactMobile = "Enter a valid emergency contact number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/profile/staff-details", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, mobile: form.mobile.trim(), email: form.email.trim(), bloodGroup: form.bloodGroup || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "message" in data ? (data as { message: unknown }).message : null;
        throw new Error(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Unable to save your details.");
      }
      setConfirming(false); setNotice("Your details were saved."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your details."); setConfirming(false); }
    finally { setSaving(false); }
  };

  const err = (key: string) => errors[key] && <p className="text-xs text-danger">{errors[key]}</p>;
  const readOnly = locked;

  return <div className="max-w-3xl">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    <section className="crm-surface">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><UserRound size={18} /></span>
        <div><h2 className="text-sm font-semibold text-foreground">My details</h2><p className="mt-0.5 text-xs text-muted">Your profile in the Bond Therapy staff record</p></div>
      </div>

      <div className="space-y-6 p-5">
        {locked
          ? <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success-soft/50 px-4 py-3"><Lock size={16} className="mt-0.5 shrink-0 text-success" /><div><p className="text-[13px] font-semibold text-foreground">Details submitted on {dateLabel(profile.detailsSubmittedAt!)}</p><p className="mt-0.5 text-xs text-muted">These are now locked. To change anything, please contact your administrator.</p></div></div>
          : <div className="flex items-start gap-3 rounded-lg border bg-brand-soft/50 px-4 py-3"><Info size={16} className="mt-0.5 shrink-0 text-brand" /><div><p className="text-[13px] font-semibold text-foreground">Please complete your details</p><p className="mt-0.5 text-xs text-muted">You can save them once. After that only an administrator can make changes.</p></div></div>}

        <section className="space-y-4">
          <Heading hint="Set by the company. You cannot change these.">Account and employment</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fixed label="Full name" value={user.name} />
            <Fixed label="Login ID" value={user.loginId} />
            <Fixed label="Employee code" value={profile.employeeCode} />
            <Fixed label="Role" value={user.roleName} />
            <Fixed label="Job title" value={profile.jobTitle} />
            <Fixed label="Employment type" value={pretty(profile.employmentType)} />
            <Fixed label="Joining date" value={dateLabel(profile.joiningDate)} />
            <Fixed label="Work location" value={profile.workLocation ?? "—"} />
            {user.manager && <Fixed label="Reporting manager" value={user.manager.name} />}
            {profile.shiftStart && profile.shiftEnd && <Fixed label="Shift" value={`${profile.shiftStart} – ${profile.shiftEnd}`} />}
          </div>
        </section>

        <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); if (!readOnly && validate()) setConfirming(true); }} noValidate autoComplete="off">
          <section className="space-y-4">
            <Heading hint={locked ? undefined : "All fields marked * are required."}>Contact details</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Field label="Mobile number *"><Input value={form.mobile} onChange={set("mobile")} type="tel" inputMode="tel" maxLength={20} readOnly={readOnly} className={readOnly ? "bg-background text-muted" : inputClass} aria-invalid={Boolean(errors.mobile)} /></Field>{err("mobile")}</div>
              <div className="space-y-1.5"><Field label="Email address *"><Input value={form.email} onChange={set("email")} type="email" inputMode="email" maxLength={254} readOnly={readOnly} placeholder={readOnly ? undefined : "you@example.com"} className={readOnly ? "bg-background text-muted" : inputClass} aria-invalid={Boolean(errors.email)} /></Field>{err("email")}</div>
              <div className="space-y-1.5 sm:col-span-2"><Field label="Residential address *"><textarea value={form.residentialAddress} onChange={set("residentialAddress")} rows={3} maxLength={500} readOnly={readOnly} className={`w-full resize-y rounded-lg border px-3 py-2.5 text-base leading-5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:text-[13px] ${readOnly ? "bg-background text-muted" : "bg-white"}`} aria-invalid={Boolean(errors.residentialAddress)} /></Field>{err("residentialAddress")}</div>
            </div>
          </section>

          <section className="space-y-4">
            <Heading>Personal details</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Field label="Date of birth *"><Input value={form.dateOfBirth} onChange={set("dateOfBirth")} type="date" max={today} readOnly={readOnly} className={readOnly ? "bg-background text-muted" : inputClass} aria-invalid={Boolean(errors.dateOfBirth)} /></Field>{err("dateOfBirth")}</div>
              <Field label="Blood group"><select value={form.bloodGroup} onChange={set("bloodGroup")} disabled={readOnly} className={selectClass}><option value="">{readOnly ? "—" : "Select blood group"}</option>{BLOOD_GROUPS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
            </div>
          </section>

          <section className="space-y-4">
            <Heading hint={locked ? undefined : "Someone we can call in an emergency."}>Emergency contact</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Field label="Contact name *"><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} maxLength={120} readOnly={readOnly} className={readOnly ? "bg-background text-muted" : inputClass} aria-invalid={Boolean(errors.emergencyContactName)} /></Field>{err("emergencyContactName")}</div>
              <div className="space-y-1.5"><Field label="Contact mobile *"><Input value={form.emergencyContactMobile} onChange={set("emergencyContactMobile")} type="tel" inputMode="tel" maxLength={20} readOnly={readOnly} className={readOnly ? "bg-background text-muted" : inputClass} aria-invalid={Boolean(errors.emergencyContactMobile)} /></Field>{err("emergencyContactMobile")}</div>
            </div>
          </section>

          {error && <FormError message={error} />}
          {!locked && <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="submit"><Save size={16} />Save details</Button></div>}
          {locked && <p className="flex items-center gap-1.5 border-t pt-4 text-xs text-muted"><CheckCircle2 size={14} className="text-success" />Stored in the company staff record.</p>}
        </form>
      </div>
    </section>

    {confirming && <Modal title="Save your details?" subtitle="Please check everything is correct." onClose={() => !saving && setConfirming(false)} maxWidth="max-w-md">
      <p className="text-sm text-foreground">Once saved, these details are locked and only an administrator can change them.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => setConfirming(false)}>Go back</Button>
        <Button type="button" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Confirm and save"}</Button>
      </div>
    </Modal>}
  </div>;
}
