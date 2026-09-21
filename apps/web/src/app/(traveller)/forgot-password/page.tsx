import { Suspense } from "react";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { ShellMain } from "@/components/shell/app-shell";

export default function ForgotPasswordPage() {
  return (
    <ShellMain>
      <Suspense>
        <RecoveryForm mode="forgot" />
      </Suspense>
    </ShellMain>
  );
}
