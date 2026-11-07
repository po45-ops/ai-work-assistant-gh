import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/** Reuse one fresh Auth lookup and Supabase client across a server render. */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    redirect("/auth/login");
  }

  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
  };
});
