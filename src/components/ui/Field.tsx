import { type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/utils";

export { Select } from "./SearchableSelect";

const fieldBase =
  "w-full rounded-md border border-border-subtle bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/65 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-medium tracking-wide text-charcoal/70 mb-1.5 uppercase", className)} {...props} />;
}

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-28 resize-y", className)} {...props} />;
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-charcoal/65 leading-relaxed">{children}</p>;
}

export function FieldError({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return <p className={cn("mt-1.5 text-xs text-red-700", className)}>{children}</p>;
}
