import type { Metadata } from "next";
import { LoginForm } from "@/components/quote/LoginForm";
import { safeCallbackPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const sp = await searchParams;
  // Sanitized here too (the server action sanitizes it again before
  // actually redirecting — see authenticateWithCredentials) so the hidden
  // form field never carries an attacker-supplied absolute URL in the
  // first place, in case anything else ever reads this prop later.
  const callbackUrl = safeCallbackPath(sp.callbackUrl);
  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="mx-auto max-w-md px-5 pb-20 pt-10 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Sign In</h1>
      <p className="mt-3 text-sm text-charcoal/65">Sign in to request quotes, submit sourcing requests, and track your history.</p>
      <div className="mt-8">
        <LoginForm callbackUrl={callbackUrl} googleEnabled={googleEnabled} />
      </div>
    </div>
  );
}
