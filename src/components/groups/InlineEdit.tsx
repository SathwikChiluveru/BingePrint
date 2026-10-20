"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SaveResult = { ok: true } | { ok: false; message: string };

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  caretColor: "var(--color-red)",
};

/**
 * A quiet "{label}: {value} · Edit" line that opens into a one-field form in place. Used on the
 * group page for the owner's rename and each member's own nickname. Save is disabled while the
 * value is blank or unchanged; Escape or Cancel puts the line back. Errors stay inline under the
 * field (role="alert") and keep what was typed. Focus moves into the field on open and back to
 * the Edit button on close.
 */
export default function InlineEdit({
  label,
  value,
  maxLength,
  editLabel,
  onSave,
  autoComplete = "off",
  display,
}: {
  /** "Your name" / "Group name": the visible label and the field's label */
  label: string;
  value: string;
  maxLength: number;
  /** Accessible name for the Edit button, e.g. "Edit your name" */
  editLabel: string;
  onSave: (next: string) => Promise<SaveResult>;
  autoComplete?: string;
  /** Hide the "{label}: {value}" text (when the value is already shown nearby, like the h1) */
  display?: "full" | "button-only";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const reopenFocus = useRef(false);
  const id = useId();

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (reopenFocus.current) {
      reopenFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  function open() {
    setDraft(value);
    setError("");
    setEditing(true);
  }

  function close() {
    reopenFocus.current = true;
    setEditing(false);
    setError("");
  }

  const trimmed = draft.trim();
  const unchanged = trimmed === value.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !trimmed || unchanged) return;
    setSaving(true);
    setError("");
    const result = await onSave(trimmed);
    setSaving(false);
    if (result.ok) close();
    else setError(result.message);
  }

  if (!editing) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {display !== "button-only" && (
          <>
            <span>
              {label}: <span className="font-semibold [overflow-wrap:anywhere]" style={{ color: "var(--color-text)" }}>{value}</span>
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <button
          ref={editRef}
          type="button"
          onClick={open}
          aria-label={editLabel}
          className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 transition-colors hover:text-[var(--color-text)]"
        >
          {display === "button-only" ? editLabel : "Edit"}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="text"
          required
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-[44px] w-full flex-1 rounded-xl px-4 py-2 text-base"
          style={inputStyle}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !trimmed || unchanged} className="btn-secondary flex-1 px-5 py-2 sm:flex-none">
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] px-3 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm" style={{ color: "var(--color-red-text)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
