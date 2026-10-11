"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp, Check } from "lucide-react";
import { saveTranslationOverride } from "@/actions/translations";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface TranslationManagerProps {
  keys: { key: string; english: string }[];
  locales: { code: string; name: string }[];
  localeFileValues: Record<string, Record<string, string>>;
  overridesByKey: Record<string, Record<string, string>>;
}

export function TranslationManager({ keys, locales, localeFileValues, overridesByKey }: TranslationManagerProps) {
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Tracks overrides saved/cleared during this session so the "using: ..."
  // hint and future re-renders reflect a save immediately, without needing
  // the whole page's server data re-fetched.
  const [liveOverrides, setLiveOverrides] = useState(overridesByKey);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.key.toLowerCase().includes(q) || k.english.toLowerCase().includes(q));
  }, [keys, query]);

  function translatedCount(key: string): number {
    const overrides = liveOverrides[key] ?? {};
    return locales.filter((l) => overrides[l.code] != null || localeFileValues[l.code]?.[key] != null).length;
  }

  function handleSaved(key: string, locale: string, value: string) {
    setLiveOverrides((prev) => {
      const next = { ...prev, [key]: { ...prev[key] } };
      if (value.trim() === "") delete next[key][locale];
      else next[key][locale] = value.trim();
      return next;
    });
  }

  return (
    <div>
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by key or English text (e.g. nav.shopGems, Shop Gems)"
          className="pl-9"
        />
      </div>
      <p className="mt-2 text-xs text-charcoal/55">
        {filtered.length} of {keys.length} keys{query && " matching"}
      </p>

      <div className="mt-4 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
        {filtered.slice(0, 200).map((item) => {
          const isOpen = expandedKey === item.key;
          const count = translatedCount(item.key);
          return (
            <div key={item.key}>
              <button
                type="button"
                onClick={() => setExpandedKey(isOpen ? null : item.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ivory-soft"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-charcoal/55">{item.key}</p>
                  <p className="mt-0.5 truncate text-sm text-charcoal">{item.english}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-charcoal/50">{count}/{locales.length}</span>
                  {isOpen ? <ChevronUp size={16} className="text-charcoal/40" /> : <ChevronDown size={16} className="text-charcoal/40" />}
                </div>
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-border-subtle bg-ivory-soft px-4 py-4">
                  {locales.map((locale) => (
                    <LocaleRow
                      key={locale.code}
                      translationKey={item.key}
                      locale={locale.code}
                      localeName={locale.name}
                      english={item.english}
                      override={liveOverrides[item.key]?.[locale.code]}
                      localeFileValue={localeFileValues[locale.code]?.[item.key]}
                      onSaved={(value) => handleSaved(item.key, locale.code, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-charcoal/55">No keys match that search.</p>}
        {filtered.length > 200 && (
          <p className="px-4 py-3 text-center text-xs text-charcoal/50">Showing the first 200 matches — narrow your search to see more.</p>
        )}
      </div>
    </div>
  );
}

function LocaleRow({
  translationKey,
  locale,
  localeName,
  english,
  override,
  localeFileValue,
  onSaved,
}: {
  translationKey: string;
  locale: string;
  localeName: string;
  english: string;
  override: string | undefined;
  localeFileValue: string | undefined;
  onSaved: (value: string) => void;
}) {
  const initial = override ?? localeFileValue ?? "";
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAdminAction();

  const source = override != null ? "your override" : localeFileValue != null ? "its existing translation" : "the English fallback";

  function handleSubmit() {
    setSaved(false);
    const fd = new FormData();
    fd.set("key", translationKey);
    fd.set("locale", locale);
    fd.set("value", value);
    run(
      async () => saveTranslationOverride(fd),
      () => {
        onSaved(value);
        setSaved(true);
      },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-charcoal/70">{localeName}</label>
        <span className="text-xs text-charcoal/50">Currently showing: {source}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder={english}
        className="mt-1.5 min-h-16"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Button type="button" size="sm" variant="gold" disabled={pending} onClick={handleSubmit}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {value.trim() !== "" && override != null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setSaved(false);
              const fd = new FormData();
              fd.set("key", translationKey);
              fd.set("locale", locale);
              fd.set("value", "");
              run(
                async () => saveTranslationOverride(fd),
                () => {
                  // Falls back to what will actually render now (the
                  // locale's own JSON value, or blank if it has none) —
                  // not a bare "", which would misleadingly suggest this
                  // locale has no text at all for this key.
                  setValue(localeFileValue ?? "");
                  onSaved("");
                },
              );
            }}
          >
            Clear override
          </Button>
        )}
        {saved && !pending && (
          <span className={cn("flex items-center gap-1 text-xs text-green-700")}>
            <Check size={13} /> Saved
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
