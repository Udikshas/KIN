const languages = [
  { label: "हिन्दी", font: "font-deva" },
  { label: "தமிழ்", font: "font-tamil" },
  { label: "മലയാളം", font: "font-sans" },
  { label: "বাংলা", font: "font-sans" },
  { label: "English", font: "font-sans" },
];

export function Languages() {
  return (
    <section id="languages" aria-label="Languages" className="scroll-mt-24 py-10">
      <p className="text-center text-lg font-medium">Speaks the language of home</p>
      <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4">
        {languages.map((l) => (
          <li key={l.label} className={`text-2xl font-semibold tracking-[-0.02em] text-ink/70 ${l.font}`}>
            {l.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
