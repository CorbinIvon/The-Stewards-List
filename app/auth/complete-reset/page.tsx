import { redirect } from "next/navigation";

export default function CompleteResetRedirect() {
  // The actual page lives under the (auth) route group which is not part of the URL,
  // so add this explicit /auth/complete-reset path to redirect to the canonical page.
  redirect("/complete-reset");
}
