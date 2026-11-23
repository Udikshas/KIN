# Kin context (tag `@context.md` at the start of any session)

Read this first. It is the reusable context for design and build work on Kin: the reference style, the theme template, the main components and how to work with the user. Project facts (stack, Sarvam, backend, costs) live in `CLAUDE.md`. If something here changes, update this file in the same turn.

---

## 1. What Kin is (one paragraph)

Kin is a mobile app that adult children install for a parent who lives alone. Every evening Kin's AI phones the parent in their own language (Hindi first), checks sleep, pain, mood and medicine, remembers past calls, and sends the family one evening card about what changed. Green / amber / red signals escalate when something is off. Built for the Singapore India Hackathon 2026 (team Rocket). Pitch: "Singapore is the customer, India is the parent."

## 1a. Build spec (artifacts we follow)

| What | Link | Use |
| --- | --- | --- |
| **Final project spec** (source of truth) | https://claude.ai/code/artifact/5cabbd8b-4398-4dba-8075-e719c27a90b9 | Decisions, Sarvam agent spec, data model, build order. Follow this when building `apps/api` and `apps/mobile` |
| Earlier research and stack comparison | https://claude.ai/code/artifact/46c770cc-db01-4d77-ade7-d4f5834d6b25 | Background only; its stack is superseded by the final spec |
| Single-file HTML landing prototype | https://claude.ai/artifact/Qb84aysPQ7jCWi6Lvj3qDK | Original landing copy and call-panel demo; source in `docs/prototypes/kin-landing.html` |

Read the final spec with the Artifact tool (`action: "read"`), not a web fetch. When a decision changes, update the spec, `CLAUDE.md` and this file together.

## 2. Design reference

| What | Link |
| --- | --- |
| Main style reference (Refero "Bevel") | https://styles.refero.design/style/c0717d1a-b446-4166-a445-6497fe287fea |
| App UI style | Apple iOS 26 "Liquid Glass" (web approximation with `backdrop-filter`) |
| Phone frame | `apps/web/public/art/iphone-frame.webp` (from the rtm-management-platform landing) |
| Archived old style (do not use) | Refero ElevenLabs, `docs/prototypes/web-v1-elevenlabs/` |

**The look in one line:** bright white health journal, mist-blue bento cards, near-black 600-weight headlines with tight tracking, soft grey body copy, pill buttons, and real iPhone mockups of a glassy, pastel-mesh app.

## 3. Theme template

### Colours

| Token | Hex | Use |
| --- | --- | --- |
| paper | `#ffffff` | Page background |
| cloud | `#ebf0f8` | Bento cards (no border, no shadow), soft buttons |
| mist | `#f4f7fb` | Subtle fills |
| line | `#e3e8f0` | Hairlines, input borders |
| ink | `#222326` | Headings, primary text |
| charcoal | `#1f2025` | Primary buttons, dark section |
| body | `#747679` | Body copy |
| faint | `#a3a6ab` | Placeholders, captions |

Metric colours, only inside product visuals and soft washes, never on buttons or links:

| Name | Landing token | App kit (deeper) |
| --- | --- | --- |
| green | `#31ce01` | `#31ce01` |
| blue | `#415eee` | `#415eee` |
| lilac | `#b9a6ff` | `#9d86ff` |
| coral | `#ffab94` | `#ff8f70` |
| gold | `#ffca00` | `#ffb800` |

Status markers (small dots / pills only): ok `#23a300` / `#e6f7df`, watch `#c77700` / `#fff4d6`, alert `#e5484d` / `#fde8e8`.

### Type

- Inter 400 / 500 / 600 via `next/font`. Noto Sans Devanagari and Noto Sans Tamil for Indic text.
- Display (`display` utility): weight 600, letter-spacing -0.03em, line-height 1. Sizes 40 / 56 / 64 / 80px.
- Body 18–24px, weight 400, colour body grey. `text-wrap: balance` on headings.

### Shape, spacing, shadow

- Buttons: pills only, radius 128px. Charcoal fill + cloud text (primary), or white / cloud (soft).
- Cards 24px, panels 32px, app glass cards 28px, inputs 14px.
- 80px section rhythm (`py-20`), `scroll-mt-24` on every anchored section.
- Shadows: `shadow-chip` for floating glass, `shadow-phone` for mockups. Tinted blue-grey, never pure black.

### Glass and mesh (Tailwind v4 `@utility`, in `apps/web/src/app/globals.css`)

```css
@utility glass {
  background: linear-gradient(160deg, rgb(255 255 255 / 0.74) 0%, rgb(255 255 255 / 0.42) 100%);
  backdrop-filter: blur(28px) saturate(1.8);
  border: 1px solid rgb(255 255 255 / 0.8);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.95),
    inset 0 -1px 2px rgb(255 255 255 / 0.35),
    0 1px 2px rgb(30 40 80 / 0.05),
    0 18px 40px -20px rgb(40 50 110 / 0.35);
}

@utility mesh-light {
  background:
    radial-gradient(62% 34% at 92% 6%, #cbbdff 0%, transparent 70%),
    radial-gradient(58% 30% at -5% 36%, #ffd2c2 0%, transparent 72%),
    radial-gradient(60% 30% at 105% 70%, #bfe2ff 0%, transparent 70%),
    radial-gradient(55% 26% at 5% 98%, #fff0b5 0%, transparent 72%),
    linear-gradient(180deg, #e3ebf8 0%, #f1f4fa 55%, #f6f3f1 100%);
}
```

Also `glass-dark` (dark screens), `glass-tint` (coloured glass), `no-scrollbar`.

### Motion

- Calm, slow, meaningful. Keyframes: breathe, drift, float, marquee, fade-up, kin-orbit, kin-breathe, kin-ripple, kin-glow.
- Everything stops under `prefers-reduced-motion`.
- Signature effects:
  - **Voice orb** (`components/ui/voice-orb.tsx`): indigo sphere, 5 orbiting blurred blobs in the metric colours, breathing glow, ripples while active. No white ring border.
  - **Bevel mask scroll** (`landing/more-features.tsx`): panels with `clip-path: inset(0 round 32px)` each hold a `position: fixed` phone at the same viewport spot, so the next screen slides up inside a phone that stays still. Pure CSS.
  - Smooth anchor scrolling: `data-scroll-behavior="smooth"` on `<html>`.

## 4. Main building blocks

| Piece | File | Notes |
| --- | --- | --- |
| Phone mockup | `apps/web/src/components/app/phone.tsx` | `Phone({ width, tone })`. Screens designed at 393 × 852, scaled with CSS `zoom`; frame image overlaid. Opening: left 5.3%, top 2.5%, width 89.4%, height 95%, radius `11.5% / 5.4%` |
| App kit | `components/app/kit.tsx` | Avatar, Rings / Ring, Pill, GlassButton, Icon, ScreenHeader (glass "Amma" pill), TabBar (glass capsule + separate phone button), Card |
| App screens | `components/app/screens.tsx` | Today, Call (dark), Lock screen (expanded notification group), Trends, Memory, Alert, Medicines, Family, Intro |
| Pill button | `components/ui/pill-link.tsx` | Variants filled / soft / inverse; sizes sm / md / lg |
| Section | `components/ui/section.tsx` | Section, SectionHead, StatusDot |
| Waitlist | `app/actions/waitlist.ts`, `landing/waitlist-form.tsx` | Server action + `useActionState`; links `#waitlist`, `#waitlist-centre`, `#waitlist-insurer` scroll to the form and preselect the role |
| All screens gallery | `/screens` route | Design review only; remove before deploy |

Landing order: Nav → Hero (3 upright phones: front Today, back-left Lock, back-right Call) → Languages → Bento → Features → Call demo → More features → Privacy → Plans → Waitlist → Footer.

Assets: `public/brand` (kin-mark, kin-logo, app-icon), `public/art` (hero-sky, wash-lilac, wash-sky, night-glow, iphone-frame), `public/avatars` (amma, kamala, joseph, neha, rahul, priya).

## 5. Content and voice

- Plain, warm, short sentences. Talk to the adult child about "your parent" / "Amma".
- Sample family: Amma (parent, Lucknow), Neha and Rahul (children), Aarav (grandchild).
- CTA wording: "Join the waitlist", "Hear a call", "Talk to us". Not "pilot".
- Kin is not a doctor: never claim diagnosis or medical advice. Emergency numbers: 108 (India ambulance), 995 (Singapore ambulance), as in the footer notice.
- No emoji in the UI. Every button and link must go somewhere real.

## 6. How to work with the user

- **Change only what is asked.** If they say one thing needs fixing, leave everything else alone (e.g. privacy icons: only the question mark was replaced).
- Ask before broad redesigns. Previously reverted: the "elderly-friendly" app redesign and a Phosphor-icon tab bar. Keep the current glass design and tab bar.
- Keep cards compact: no big empty areas in cards or phone screens.
- Verify visually in the browser preview after UI changes, then report briefly.
- Run `pnpm lint` (and `pnpm build` before deploys) from the repo root.
- Do not commit unless asked.
- Next.js 16 differs from older versions: check `apps/web/node_modules/next/dist/docs/` for unfamiliar APIs.

## 7. Open items

- Deploy: set `NEXT_PUBLIC_SITE_URL` and `WAITLIST_FILE` (persistent Coolify volume); remove `/screens`.
- Later: move waitlist to FastAPI / Postgres; optional dark mode.
