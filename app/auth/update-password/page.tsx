import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
export default function Page() {
  return (
    <AuthShell>
      <UpdatePasswordForm />
    </AuthShell>
  );
}
