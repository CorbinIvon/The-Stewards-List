import { redirect } from "next/navigation";

/**
 * Redirect /auth root to /auth/login
 */
export default function AuthPage(): never {
  redirect("/login");
}
