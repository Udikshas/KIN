"use client";

import { useEffect, useRef, useState } from "react";

// Same as MAX_MEMBERS in app/actions/demo.ts (a "use server" file can only export functions).
const MAX_MEMBERS = 4;
const MEMBER_KEYS = ["name", "relation", "city", "notes"] as const;

const field =
  "h-12 w-full rounded-[14px] border bg-white px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";
const area =
  "min-h-[76px] w-full resize-y rounded-[14px] border bg-white px-4 py-3 text-[16px] leading-snug text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";

type Errors = Partial<Record<"fam_name" | "fam_context" | "fam_about" | "fam_avoid" | "members", string>>;

// Advanced: who the family is and what Kin may bring up. Saved for this number only.
// The inputs live in a modal <dialog> inside the form, so they still submit with it
// while the form itself stays short.
export function FamilyFields({ values, errors }: { values: Record<string, string>; errors: Errors }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const filled = Array.from({ length: MAX_MEMBERS }, (_, i) =>
    MEMBER_KEYS.some((k) => values[`member_${i}_${k}`]),
  ).lastIndexOf(true);
  // Stable row ids (keys), so removing a middle row keeps the others' typed text.
  // Inputs are named by position, so the submitted rows are always member_0..n.
  const [rows, setRows] = useState(() => Array.from({ length: Math.max(1, filled + 1) }, (_, i) => i));
  const nextId = useRef(MAX_MEMBERS);
  const [summary, setSummary] = useState(() => summarise(values));
  const hasError = Object.values(errors).some(Boolean);

  // Reopen after a failed submit so the highlighted field is visible.
  useEffect(() => {
    if (hasError) dialog.current?.showModal();
  }, [hasError]);

  const read = () => {
    const box = dialog.current;
    if (!box) return;
    const now: Record<string, string> = {};
    box.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el) => {
      now[el.name] = el.value.trim();
    });
    setSummary(summarise(now));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`flex w-full items-center justify-between gap-3 rounded-[18px] border bg-white/60 px-4 py-3 text-left transition-colors hover:bg-white ${
          hasError ? "border-alert" : "border-line"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">
            Family <span className="font-normal text-body">· advanced</span>
          </span>
          <span className={`block truncate text-[14px] ${hasError ? "text-alert" : "text-body"}`}>
            {hasError ? "Please check the family details." : summary || "Add family members, news and what they enjoy"}
          </span>
        </span>
        <span className="shrink-0 rounded-[128px] bg-cloud px-3 py-1.5 text-[14px] font-medium text-ink">
          {summary ? "Edit" : "Add"}
        </span>
      </button>

      <dialog
        ref={dialog}
        onClose={read}
        onKeyDown={(e) => {
          // Enter in a text field would submit the outer form and place the call.
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
        }}
        onClick={(e) => {
          // Click on the backdrop closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[min(860px,calc(100dvh-32px))] w-[min(880px,calc(100vw-32px))] overflow-hidden rounded-[28px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div>
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Family details</h2>
              <p className="mt-1 text-[14px] leading-snug text-body">
                Kin weaves this into the chat, such as asking about a son&apos;s new job. Saved for this number only and used on
                its later calls too.
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={() => dialog.current?.close()}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-cloud text-ink hover:bg-line">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
            <Labeled label="Family name" error={errors.fam_name}>
              <input name="fam_name" placeholder="The Sharma family" defaultValue={values.fam_name}
                className={`${field} ${errors.fam_name ? "border-alert" : "border-line"}`} />
            </Labeled>

            <Labeled label="Topics to avoid" error={errors.fam_avoid}>
              <input name="fam_avoid" placeholder="Papa's illness" defaultValue={values.fam_avoid}
                className={`${field} ${errors.fam_avoid ? "border-alert" : "border-line"}`} />
            </Labeled>

            <Labeled label="About them" hint="routine, likes, how they like to be spoken to" error={errors.fam_about}>
              <textarea name="fam_about" rows={2} placeholder="Loves old Kishore Kumar songs, walks in the park every morning"
                defaultValue={values.fam_about} className={`${area} ${errors.fam_about ? "border-alert" : "border-line"}`} />
            </Labeled>

            <Labeled label="Family news" hint="happy for Kin to mention" error={errors.fam_context}>
              <textarea name="fam_context" rows={2} placeholder="Diwali at Om's place this year"
                defaultValue={values.fam_context} className={`${area} ${errors.fam_context ? "border-alert" : "border-line"}`} />
            </Labeled>

            <fieldset className="flex flex-col gap-3 md:col-span-2">
              <legend className="mb-2 text-[15px] font-semibold">Family members</legend>
              {rows.map((id, i) => (
                <div key={id} className="flex items-start gap-2 rounded-[16px] bg-cloud p-2">
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-[1fr_1fr_1fr_1.6fr]">
                    <input name={`member_${i}_name`} placeholder="Name" aria-label={`Member ${i + 1} name`}
                      defaultValue={values[`member_${id}_name`]} className={`${field} border-line`} />
                    <input name={`member_${i}_relation`} placeholder="Relation" aria-label={`Member ${i + 1} relation`}
                      defaultValue={values[`member_${id}_relation`]} className={`${field} border-line`} />
                    <input name={`member_${i}_city`} placeholder="City" aria-label={`Member ${i + 1} city`}
                      defaultValue={values[`member_${id}_city`]} className={`${field} col-span-2 border-line sm:col-span-1`} />
                    <input name={`member_${i}_notes`} placeholder="Their news, e.g. new job" aria-label={`Member ${i + 1} news`}
                      defaultValue={values[`member_${id}_notes`]} className={`${field} col-span-2 border-line sm:col-span-3 md:col-span-1`} />
                  </div>
                  {rows.length > 1 ? (
                    <button type="button" aria-label={`Remove member ${i + 1}`}
                      onClick={() => setRows((r) => r.filter((x) => x !== id))}
                      className="grid size-12 shrink-0 place-items-center rounded-[14px] text-body transition-colors hover:bg-white hover:text-alert">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ))}
              {errors.members ? <span className="text-[14px] text-alert">{errors.members}</span> : null}
              {rows.length < MAX_MEMBERS ? (
                <button type="button" onClick={() => setRows((r) => [...r, nextId.current++])}
                  className="h-10 self-start rounded-[128px] bg-cloud px-4 text-[15px] font-medium text-ink transition-colors hover:bg-line">
                  + Add member
                </button>
              ) : null}
            </fieldset>

          </div>

          <div className="flex justify-end border-t border-line px-6 py-4">
            <button type="button" onClick={() => dialog.current?.close()}
              className="h-11 rounded-[128px] bg-charcoal px-6 font-medium text-cloud hover:bg-black">
              Done
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

// "The Sharma family · Om, Neha · news" — what the closed button shows.
function summarise(v: Record<string, string>) {
  const names = Array.from({ length: MAX_MEMBERS }, (_, i) => v[`member_${i}_name`]).filter(Boolean);
  const parts = [
    v.fam_name,
    names.length ? names.join(", ") : "",
    v.fam_about ? "about them" : "",
    v.fam_context ? "news" : "",
    v.fam_avoid ? "topics to avoid" : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function Labeled({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[15px] font-semibold">
        {label} {hint ? <span className="font-normal text-body">· {hint}</span> : null}
      </span>
      {children}
      {error ? <span className="text-[14px] text-alert">{error}</span> : null}
    </label>
  );
}
