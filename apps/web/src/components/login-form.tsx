"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  identifier: z.string().trim().min(2, "Enter your login ID or email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  remember: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "", remember: false } });

  const onSubmit = async (values: FormValues) => {
    setServerError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as { message?: string; user?: { dashboardPath?: string } } | null;
    if (!response.ok) {
      setServerError(data?.message ?? "Unable to sign in. Please try again.");
      return;
    }
    router.replace(data?.user?.dashboardPath ?? "/dashboard");
    router.refresh();
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <label className="text-[13px] font-medium text-foreground" htmlFor="identifier">Login ID or email</label>
        <Input id="identifier" autoComplete="username" placeholder="Enter your login ID" aria-invalid={Boolean(errors.identifier)} {...register("identifier")} />
        {errors.identifier && <p className="text-xs text-danger">{errors.identifier.message}</p>}
      </div>
      <div className="space-y-2">
        <label className="text-[13px] font-medium text-foreground" htmlFor="password">Password</label>
        <div className="relative">
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="pr-11" aria-invalid={Boolean(errors.password)} {...register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-muted hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
        <input type="checkbox" className="size-4 rounded border-border accent-brand" {...register("remember")} />
        Keep me signed in on this device
      </label>
      {serverError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-danger">{serverError}</div>}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <LockKeyhole size={17} />}
        {isSubmitting ? "Signing in..." : "Sign in securely"}
        {!isSubmitting && <ArrowRight className="ml-auto" size={17} />}
      </Button>
    </form>
  );
}

