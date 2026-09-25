"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound, LoaderCircle, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortalType } from "@/lib/portal-types";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email is too long."),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(8, "Enter your current password."),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(128, "Password is too long."),
  confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type Profile = ProfileValues & {
  loginId: string;
  roleName: string;
  portal: PortalType;
  status: string;
  department: "PURCHASE" | "SALES" | "ACCOUNTS_BILLING" | "WAREHOUSE" | "DEMO" | null;
  dataScope: "OWN" | "TEAM" | "DEPARTMENT" | "COMPANY";
  managerName: string | null;
  staffProfile: {
    employeeCode: string;
    mobile: string;
    jobTitle: string;
    employmentType: string;
    joiningDate: string;
    dateOfBirth: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    bloodGroup: string | null;
    workLocation: string | null;
    residentialAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactMobile: string | null;
  } | null;
};

const label = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));

function ErrorMessage({ children }: { children?: string }) {
  return children ? <p className="text-xs text-danger">{children}</p> : null;
}

export function ProfileSettings({ initialProfile, canChangePassword }: { initialProfile: Profile; canChangePassword: boolean }) {
  const router = useRouter();
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialProfile.name, email: initialProfile.email },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const saveProfile = async (values: ProfileValues) => {
    setProfileMessage("");
    setProfileError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as { name?: string; email?: string; message?: string } | null;
      if (!response.ok) {
        setProfileError(data?.message ?? "Unable to save your profile.");
        return;
      }
      profileForm.reset({ name: data?.name ?? values.name, email: data?.email ?? values.email });
      setProfileMessage("Profile updated successfully.");
      router.refresh();
    } catch {
      setProfileError("Profile service is temporarily unavailable.");
    }
  };

  const changePassword = async (values: PasswordValues) => {
    setPasswordError("");
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setPasswordError(data?.message ?? "Unable to change your password.");
        return;
      }
      window.location.replace("/login?passwordChanged=1");
    } catch {
      setPasswordError("Password service is temporarily unavailable.");
    }
  };

  return (
    <div className={canChangePassword ? "grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]" : "max-w-3xl"}>
      <section className="crm-surface">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><UserRound size={18} /></span>
          <div><h2 className="text-sm font-semibold text-foreground">Profile details</h2><p className="mt-0.5 text-xs text-muted">Information connected to your account</p></div>
        </div>
        <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={profileForm.handleSubmit(saveProfile)} autoComplete="off" noValidate>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-name">Full name</label>
            <Controller name="name" control={profileForm.control} render={({ field }) => <Input id="profile-name" autoComplete="off" data-1p-ignore data-lpignore="true" aria-invalid={Boolean(profileForm.formState.errors.name)} {...field} name="profileDisplayName" />} />
            <ErrorMessage>{profileForm.formState.errors.name?.message}</ErrorMessage>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-contact">Email address</label>
            <Controller name="email" control={profileForm.control} render={({ field }) => <Input id="profile-contact" type="text" inputMode="email" autoComplete="off" data-1p-ignore data-lpignore="true" aria-invalid={Boolean(profileForm.formState.errors.email)} {...field} name="profileContact" />} />
            <ErrorMessage>{profileForm.formState.errors.email?.message}</ErrorMessage>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-login-id">Login ID</label>
            <Input id="profile-login-id" value={initialProfile.loginId} readOnly className="bg-background text-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-role">Assigned role</label>
            <Input id="profile-role" value={initialProfile.roleName} readOnly className="bg-background text-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-portal">Portal</label>
            <Input id="profile-portal" value={initialProfile.portal === "ADMIN" ? "Administration" : initialProfile.portal === "STAFF" ? "Staff" : "Distributor"} readOnly className="bg-background text-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-status">Account status</label>
            <Input id="profile-status" value={initialProfile.status.charAt(0) + initialProfile.status.slice(1).toLowerCase()} readOnly className="bg-background text-muted" />
          </div>
          {initialProfile.department && <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-department">Department</label>
            <Input id="profile-department" value={label(initialProfile.department)} readOnly className="bg-background text-muted" />
          </div>}
          {initialProfile.department && <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-scope">Record access</label>
            <Input id="profile-scope" value={label(initialProfile.dataScope)} readOnly className="bg-background text-muted" />
          </div>}
          {initialProfile.managerName && <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-foreground" htmlFor="profile-manager">Reporting manager</label>
            <Input id="profile-manager" value={initialProfile.managerName} readOnly className="bg-background text-muted" />
          </div>}
          {initialProfile.staffProfile && <>
            <div className="mt-2 border-t pt-4 sm:col-span-2"><h3 className="text-sm font-semibold text-foreground">Employment details</h3></div>
            <ReadOnlyField id="profile-employee-code" label="Employee code" value={initialProfile.staffProfile.employeeCode} />
            <ReadOnlyField id="profile-mobile" label="Mobile" value={initialProfile.staffProfile.mobile} />
            <ReadOnlyField id="profile-job-title" label="Job title" value={initialProfile.staffProfile.jobTitle} />
            <ReadOnlyField id="profile-employment-type" label="Employment type" value={label(initialProfile.staffProfile.employmentType)} />
            <ReadOnlyField id="profile-joining-date" label="Joining date" value={dateLabel(initialProfile.staffProfile.joiningDate)} />
            <ReadOnlyField id="profile-work-location" label="Work location" value={initialProfile.staffProfile.workLocation ?? "—"} />
            <ReadOnlyField id="profile-shift" label="Shift" value={initialProfile.staffProfile.shiftStart && initialProfile.staffProfile.shiftEnd ? `${initialProfile.staffProfile.shiftStart} – ${initialProfile.staffProfile.shiftEnd}` : "—"} />
            <ReadOnlyField id="profile-blood-group" label="Blood group" value={initialProfile.staffProfile.bloodGroup ? label(initialProfile.staffProfile.bloodGroup).replace(" Positive", "+").replace(" Negative", "-") : "—"} />
          </>}
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs" aria-live="polite">
              {profileMessage && <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 size={14} />{profileMessage}</span>}
              {profileError && <span role="alert" className="text-danger">{profileError}</span>}
            </div>
            <Button type="submit" disabled={profileForm.formState.isSubmitting || !profileForm.formState.isDirty}>
              {profileForm.formState.isSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              {profileForm.formState.isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      {canChangePassword && <section className="h-fit crm-surface">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><KeyRound size={18} /></span>
          <div><h2 className="text-sm font-semibold text-foreground">Change password</h2><p className="mt-0.5 text-xs text-muted">You will sign in again after changing it</p></div>
        </div>
        <form className="space-y-4 p-5" onSubmit={passwordForm.handleSubmit(changePassword)} noValidate>
          <input className="sr-only" type="text" name="username" value={initialProfile.loginId} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="current-password">Current password</label>
            <Input id="current-password" type="password" autoComplete="current-password" aria-invalid={Boolean(passwordForm.formState.errors.currentPassword)} {...passwordForm.register("currentPassword")} />
            <ErrorMessage>{passwordForm.formState.errors.currentPassword?.message}</ErrorMessage>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="new-password">New password</label>
            <Input id="new-password" type="password" autoComplete="new-password" aria-invalid={Boolean(passwordForm.formState.errors.newPassword)} {...passwordForm.register("newPassword")} />
            <ErrorMessage>{passwordForm.formState.errors.newPassword?.message}</ErrorMessage>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="confirm-password">Confirm new password</label>
            <Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={Boolean(passwordForm.formState.errors.confirmPassword)} {...passwordForm.register("confirmPassword")} />
            <ErrorMessage>{passwordForm.formState.errors.confirmPassword?.message}</ErrorMessage>
          </div>
          {passwordError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{passwordError}</div>}
          <Button className="w-full" type="submit" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting && <LoaderCircle className="animate-spin" size={16} />}
            {passwordForm.formState.isSubmitting ? "Changing password..." : "Change password"}
          </Button>
        </form>
      </section>}
    </div>
  );
}

function ReadOnlyField({ id, label: fieldLabel, value }: { id: string; label: string; value: string }) {
  return <div className="space-y-1.5"><label className="text-xs font-medium text-foreground" htmlFor={id}>{fieldLabel}</label><Input id={id} value={value} readOnly className="bg-background text-muted" /></div>;
}
