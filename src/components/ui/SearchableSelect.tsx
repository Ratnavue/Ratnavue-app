"use client";

import {
  Children, isValidElement, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border-subtle bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/65 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors";

interface FlatOption {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

// Reads the same children every caller already passes a native <select> —
// plain <option>s and/or <option>s nested in <optgroup>s — so this is a
// drop-in replacement with zero call-site changes for the ~20 places that
// already render <Select>{...options}</Select>.
function flattenOptions(children: ReactNode): FlatOption[] {
  const out: FlatOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") {
      const el = child as ReactElement<{ label?: string; children?: ReactNode }>;
      Children.forEach(el.props.children, (opt) => {
        if (!isValidElement(opt)) return;
        const o = opt as ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }>;
        out.push({
          value: String(o.props.value ?? o.props.children ?? ""),
          label: String(o.props.children ?? ""),
          disabled: !!o.props.disabled,
          group: el.props.label,
        });
      });
    } else if (child.type === "option") {
      const el = child as ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }>;
      out.push({ value: String(el.props.value ?? el.props.children ?? ""), label: String(el.props.children ?? ""), disabled: !!el.props.disabled });
    }
  });
  return out;
}

/**
 * A searchable, type-to-filter dropdown — a drop-in replacement for a
 * native <select> (same value/defaultValue/onChange/name/id/required/
 * disabled/className surface, same <option>/<optgroup> children), so
 * every existing call site works unchanged. A real, visually-hidden
 * native <select> (with the same children) is kept underneath purely so
 * HTML form submission (FormData) and `required` constraint validation
 * keep working exactly as they did before — the visible input is a pure
 * presentation/interaction layer on top of it, never itself submitted
 * (it carries no `name`).
 */
export function Select({
  className, children, value, defaultValue, onChange, name, id, required, disabled, placeholder, listClassName, optionClassName,
}: SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
  /** Overrides the popup list's own box styling (default: light theme) —
   * for a dark-themed trigger (e.g. CollectionGrid's pills), pass dark
   * equivalents so the open list doesn't render light-on-light. */
  listClassName?: string;
  /** Overrides each option row's text/hover styling, same reasoning as listClassName. */
  optionClassName?: string;
}) {
  const options = useMemo(() => flattenOptions(children), [children]);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => (defaultValue != null ? String(defaultValue) : ""));
  const currentValue = isControlled ? String(value ?? "") : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === currentValue);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);
  const enabledFiltered = useMemo(() => filtered.filter((o) => !o.disabled), [filtered]);

  // Reset the keyboard-highlighted row whenever the query changes or the
  // list opens/closes — adjusted during render (not an effect), so it
  // takes effect in the same pass instead of a cascading extra render.
  const resetKey = `${query}\u0000${open}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setHighlight(0);
  }

  // Click (or focus) anywhere outside closes the list and discards any
  // typed-but-not-selected query, same as a native select's own dropdown.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectValue(nextValue: string) {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.({ target: { value: nextValue, name: name ?? "" } } as unknown as ChangeEvent<HTMLSelectElement>);
  }

  function selectOption(opt: FlatOption) {
    if (opt.disabled) return;
    selectValue(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, enabledFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = enabledFiltered[highlight];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  // Renders group headers inline whenever the (already-contiguous, since
  // it follows children order) group changes — covers the two cut
  // pickers (GemstoneForm, GemConfiguratorClient) that split one flat
  // list into "Faceted"/"Cabochon" <optgroup>s. Built with reduce (a
  // fresh accumulator per render) rather than a mutable outer variable.
  const { items: listItems } = filtered.reduce<{ items: ReactNode[]; lastGroup?: string }>(
    (acc, opt, i) => {
      const showGroupHeader = opt.group != null && opt.group !== acc.lastGroup;
      const enabledIndex = enabledFiltered.indexOf(opt);
      const isHighlighted = enabledIndex !== -1 && enabledIndex === highlight;
      acc.items.push(
        <li key={`${opt.group ?? ""}:${opt.value}:${i}`}>
          {showGroupHeader && <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-charcoal/50">{opt.group}</p>}
          <button
            type="button"
            role="option"
            aria-selected={opt.value === currentValue}
            disabled={opt.disabled}
            onMouseDown={(e) => {
              // mousedown (not click) fires before the input's onBlur, so the
              // selection registers before the list closes itself.
              e.preventDefault();
              selectOption(opt);
            }}
            className={cn(
              "block w-full truncate px-3 py-1.5 text-left text-sm",
              opt.disabled ? "cursor-not-allowed text-charcoal/35" : "cursor-pointer text-charcoal hover:bg-gold/10",
              isHighlighted && "bg-gold/15",
              opt.value === currentValue && !opt.disabled && "font-medium",
              optionClassName,
            )}
          >
            {opt.label}
          </button>
        </li>,
      );
      return { items: acc.items, lastGroup: opt.group };
    },
    { items: [], lastGroup: undefined },
  );

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (selected?.label ?? "")}
        placeholder={open ? "Search…" : (placeholder ?? "Select…")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        className={cn(fieldBase, "pr-8", className)}
      />
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/45" />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className={cn("absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-subtle bg-surface py-1 shadow-lg", listClassName)}
        >
          {listItems.length > 0 ? listItems : <li className="px-3 py-2 text-sm text-charcoal/55">No matches</li>}
        </ul>
      )}

      {/* The real form field — never shown, never itself focusable, but
          submits via FormData and enforces `required` exactly like the
          native <select> this replaces. */}
      <select
        name={name}
        id={id}
        required={required}
        disabled={disabled}
        value={currentValue}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      >
        {children}
      </select>
    </div>
  );
}
