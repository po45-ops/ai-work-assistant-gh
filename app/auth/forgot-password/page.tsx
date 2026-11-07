import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
export default function Page() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
