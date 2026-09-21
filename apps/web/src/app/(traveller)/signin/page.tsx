import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { ShellMain } from "@/components/shell/app-shell";

export default function SignInPage() {
  return (
    <ShellMain>
      <Suspense>
        <AuthForm mode="signin" />
      </Suspense>
    </ShellMain>
  );
}
