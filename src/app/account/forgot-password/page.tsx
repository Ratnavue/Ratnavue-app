import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/quote/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset Password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-5 pb-20 pt-10 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Forgot Password</h1>
      <p className="mt-3 text-sm text-charcoal/65">Enter the email on your account and we&apos;ll send you a link to reset your password.</p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
