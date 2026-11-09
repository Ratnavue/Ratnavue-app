import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { SUPPORTED_LOCALES } from "@/i18n/request";

// Guards the message catalogs in messages/*.json: every language must carry
// every key English has (a missing key silently falls back to English), and a
// translation must keep the same {placeholders} as the English text — a
// renamed or dropped placeholder renders as a literal "{count}" or loses the
// value entirely.

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === "string") out.set(prefix + key, value);
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

// Top-level ICU argument names: "{count, plural, one {# piece} …}" → count,
// "{mineral}" → mineral. Nested plural branches ({# piece}) are skipped.
function placeholders(text: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][\w]*)/.exec(text.slice(i));
        if (match) names.add(match[1]);
      }
      depth++;
    } else if (text[i] === "}") depth--;
  }
  return [...names].sort();
}

const english = flatten(load("en"));

describe.each(SUPPORTED_LOCALES.filter((l) => l !== "en"))("messages/%s.json", (locale) => {
  const translated = flatten(load(locale));

  it("has every key English has", () => {
    const missing = [...english.keys()].filter((key) => !translated.has(key));
    expect(missing).toEqual([]);
  });

  it("has no keys English doesn't", () => {
    const extra = [...translated.keys()].filter((key) => !english.has(key));
    expect(extra).toEqual([]);
  });

  it("keeps the same {placeholders} as English", () => {
    const mismatched = [...english]
      .filter(([key]) => translated.has(key))
      .filter(([key, text]) => placeholders(text).join() !== placeholders(translated.get(key)!).join())
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("has no empty strings", () => {
    expect([...translated].filter(([, text]) => !text.trim()).map(([key]) => key)).toEqual([]);
  });
});
