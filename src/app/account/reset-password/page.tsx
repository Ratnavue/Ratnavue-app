import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { ResetPasswordForm } from "@/components/quote/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset Password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/account/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <div className="mx-auto max-w-md px-5 pb-20 pt-10 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Reset Password</h1>
      {token ? (
        <>
          <p className="mt-3 text-sm text-charcoal/65">Choose a new password for your account.</p>
          <div className="mt-8">
            <ResetPasswordForm token={token} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-charcoal/65">
          This link is missing its reset token.{" "}
          <Link href="/account/forgot-password" className="underline hover:text-charcoal">
            Request a new one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
