"use client";

import { countries, countryLabel, groupDigits, INDIA, phoneDigits, type Country } from "@/lib/kin/validate";

import { inputClass, Label } from "./ui";

/** Country code + local digits, checked with the app's rules (lib/kin/validate). Parents are India-only. */
export function PhoneField({
  label,
  digits,
  country,
  onChange,
  onCountry,
  error,
  indiaOnly,
}: {
  label: string;
  digits: string;
  country: Country;
  onChange: (digits: string) => void;
  onCountry?: (c: Country) => void;
  error?: string;
  indiaOnly?: boolean;
}) {
  const list = indiaOnly ? [INDIA] : countries;
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={country.id}
          disabled={indiaOnly}
          onChange={(e) => onCountry?.(list.find((c) => c.id === e.target.value) ?? INDIA)}
          className={`${inputClass} !w-[104px] shrink-0 cursor-pointer disabled:opacity-100`}
        >
          {list.map((c) => (
            <option key={c.id} value={c.id} label={c.dial}>
              {countryLabel(c)}
            </option>
          ))}
        </select>
        <input
          inputMode="tel"
          autoComplete="tel-national"
          value={groupDigits(digits, country)}
          onChange={(e) => onChange(phoneDigits(e.target.value, country))}
          placeholder={groupDigits(country.example, country)}
          className={`${inputClass} tabular-nums ${error ? "border-alert" : ""}`}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <span className="mt-1 block px-1 text-[13px] text-alert">{error}</span> : null}
    </div>
  );
}
