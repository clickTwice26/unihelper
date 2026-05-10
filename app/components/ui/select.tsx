/**
 * CustomSelect — a fully styled, accessible dropdown that replaces
 * every native <select> in the app. Renders a hidden <select> for
 * form submission so it works inside React Router <Form> with zero
 * extra wiring.
 *
 * Usage:
 *   <CustomSelect name="category" value={val} onChange={setVal} options={[...]} />
 *   or uncontrolled:
 *   <CustomSelect name="category" defaultValue="OTHER" options={[...]} />
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional icon rendered left of the label inside the list item. */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

type Props = {
  name: string;
  options: SelectOption[];
  /** Controlled value */
  value?: string;
  /** Uncontrolled default */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra class names on the trigger button */
  className?: string;
  /** Form id if the select lives outside a <form> element */
  form?: string;
  required?: boolean;
};

export function CustomSelect({
  name,
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "Select…",
  disabled = false,
  className = "",
  form,
  required,
}: Props) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? ""
  );

  const current = isControlled ? controlledValue : internalValue;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Direct DOM ref so form.submit() always sees the latest value even before React re-render
  const hiddenRef = useRef<HTMLSelectElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Close on Escape, navigate with arrow keys
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = options.findIndex((o) => o.value === current);
        const next = e.key === "ArrowDown"
          ? Math.min(idx + 1, options.length - 1)
          : Math.max(idx - 1, 0);
        pick(options[next].value);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current, options]);

  // Scroll active item into view when opening
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLLIElement>('[data-active="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function pick(val: string) {
    // Directly update the DOM value before React re-renders so that
    // any immediate form.submit() call (e.g. quiz reorder) sees the new value.
    if (hiddenRef.current) hiddenRef.current.value = val;
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
    setOpen(false);
  }

  const Icon = selected?.icon;

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden native select for form submission */}
      <select
        ref={hiddenRef}
        name={name}
        value={current}
        onChange={(e) => pick(e.target.value)}
        form={form}
        required={required}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Visible trigger */}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
          "bg-white text-left text-slate-900 shadow-none outline-none transition",
          "focus:ring-2 focus:ring-indigo-500/20",
          open
            ? "border-indigo-500 ring-2 ring-indigo-500/20"
            : "border-slate-300 hover:border-slate-400",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {Icon && <Icon size={14} className="shrink-0 text-slate-500" />}
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          id={`${name}-listbox`}
          role="listbox"
          aria-label={name}
          className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5 focus:outline-none"
        >
          {options.map((opt) => {
            const active = opt.value === current;
            const OptIcon = opt.icon;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={active}
                data-active={active}
                onClick={() => pick(opt.value)}
                className={[
                  "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {OptIcon && (
                  <OptIcon
                    size={14}
                    className={`shrink-0 ${active ? "text-indigo-500" : "text-slate-400"}`}
                  />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {active && <Check size={13} className="shrink-0 text-indigo-500" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
