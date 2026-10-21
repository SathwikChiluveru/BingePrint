import type { CSSProperties, ReactNode } from "react";
import { CURRENCIES, type Currency } from "./money";

// DESIGN.md Inputs / Fields: Seat Row Raised fill, 1px Hairline, 12px radius, 12x16 padding (44px).
export const fieldClass =
  "w-full min-h-[44px] px-4 py-3 text-base tabular-nums";
export const fieldStyle: CSSProperties = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  caretColor: "var(--color-red)",
  borderRadius: "var(--radius-md)",
};

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
      {children}
    </label>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  step = "any",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={fieldClass}
        style={fieldStyle}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs" style={{ color: "var(--color-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function CurrencySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Currency;
  onChange: (value: Currency) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>Currency</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Currency)}
        className={`${fieldClass} cursor-pointer appearance-none pr-10`}
        style={{
          ...fieldStyle,
          // A drawn chevron: appearance-none drops the native one, which renders light on dark.
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23b3b3b3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
        }}
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c} style={{ background: "var(--color-surface-2)" }}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Section frame: h2 Title, optional lead, then the body. Hairline above, 48px between sections. */
export function ReceiptSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-t pt-12" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex flex-col gap-2">
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
        {lead && (
          <p className="max-w-[60ch]" style={{ color: "var(--color-text-secondary)" }}>
            {lead}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
