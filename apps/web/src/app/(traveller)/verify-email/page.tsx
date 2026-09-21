import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { ShellMain } from "@/components/shell/app-shell";

export default function VerifyEmailPage() {
  return (
    <ShellMain>
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </ShellMain>
  );
}
