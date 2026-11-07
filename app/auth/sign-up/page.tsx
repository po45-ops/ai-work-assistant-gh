import { SignUpForm } from "@/components/sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";
export default function Page() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
