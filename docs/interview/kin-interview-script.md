# Kin: Interview Script and Project Brief

Singapore India Hackathon 2026 · Om Sharma (Team Rocket, solo build) · Theme: Social Innovation and Inclusive Development
Interview: 11 Oct 2026, 11:00 am, Panel 7, Microsoft Teams · 3–4 min pitch + 5–8 min Q&A

---

## 1. Kin in one minute

**One line:** Kin is an AI that phones a parent who lives alone every evening, in their own language, and tells the family how they really are.

**Pitch line:** Singapore is the customer, India is the parent.

| | |
|---|---|
| **Who it helps** | Parents growing old alone at home, and their children who live far away (another city, country or time zone) |
| **The problem** | Parents say "I am fine" so children don't worry. Poor sleep, pain and skipped medicines stay hidden until a hospital calls. Apps, wearables and panic buttons need elders to learn new tech; most never do. |
| **The solution** | One warm 3-minute phone call every evening. It checks sleep, pain, food, mood and medicines as a friendly chat, remembers past calls, and sends the family one card: green, amber or red. |
| **Why it's different** | No app, no smartphone, nothing to wear or charge: any phone works. The conversation itself is the sensor. |
| **Proof it's real** | Real Indian number (+91 79714 13869, live since 9 Oct 2026). Live API at api.kin.garcade.in. First real calls on 10 Oct 2026. Cost measured on real calls. |

### What is live today vs next

| Live today | Building next |
|---|---|
| Outbound calls via Sarvam Instant Outbound | Claude summaries and 30-day health trends |
| Inbound calls: parent dials Kin and is greeted by name | Family app (Expo + React Native), push notifications |
| Memory: last 5 calls and open threads (pain, missed medicines, call-back requests) feed the next call | Scheduler worker with retries, then neighbour or alternate contact |
| 11 Indian languages, switches mid-call | Phone OTP login (needs SMS provider + India DLT) |
| Knowledge base for questions about Kin | WhatsApp card |
| Introduction mode and spoken consent | Mandarin/Hokkien for Singapore elders |
| Safety: 108 guidance, urgent flag, transfer to family | |
| FastAPI + Postgres on own VPS (Coolify): webhooks, transcripts, families, waitlist | |
| Landing page with real call audio, Try-it page that places real calls | |

---

## 2. Pitch script (about 3.5 minutes)

### Slide 1: Cover (~30 s)

> Good morning everyone, I'm Om Sharma. I built Kin to help two kinds of people: parents growing old alone at home, and their children who live far away, in another city, another country, often another time zone. Kin keeps them close: an AI that phones the parent every evening and tells the family how they really are. And I have actually built the calling part; I'll show it to you after the presentation.

### Slide 2: Problem (~35 s)

> Both countries are ageing fast. In Singapore, 21 percent are already over 65, and in India, 347 million people will be over 60 by 2050. And when we call our parents, they say "I am fine", because they don't want us to worry. So pain, poor sleep and skipped tablets stay hidden until a hospital calls. Kin gently asks every day, and because it talks to them daily, it spots the trend early, so the family can act before it becomes an emergency.

### Slide 3: Solution (~45 s)

> Kin calls every evening, in the parent's own language, and it switches if they do. It feels like a chat with a relative, not a checklist. The part people love is memory: it asks "is your knee better than yesterday?" or "how did your grandson's exam go?". The parent can call Kin back any time, and it greets them by name. It's introduced on a three-way call with the child, and the parent gives their own spoken yes, so it's never forced on them. After each call the family gets one card: green, amber or red. And if the parent mentions chest pain or a fall, Kin tells them to call 108 and connects the family right away.

### Slide 4: Technical approach (~55 s)

> Here's what happens behind one call. One: my Kin API, in FastAPI, places the call at the time the family chose, on a real Indian number I rent from Sarvam. Two: the parent picks up and talks. In real time, Saaras hears them, sarvam-105b decides the reply using the parent's profile and memory, and Bulbul speaks back in a natural voice. Three: when the call ends, Sarvam sends the result to my API, which saves the transcript, summary, sleep, mood and medicines in Postgres, ready for the next call. All of that is live today. The dashed parts are next: Claude turns the summaries into 30-day health trends, the family app in Expo and React Native, and retries that reach a neighbour if nobody answers. It all runs on my own server with Docker and Coolify, so there's no lock-in and costs stay low.

### Slide 5: Innovation, scale, impact (~45 s)

> What's new: the parent needs nothing new. Any phone works, even a basic keypad phone, with no app and nothing to wear or charge. The conversation itself is the sensor. It's affordable, and I measured it on real calls: a three-minute call costs about 11 rupees, around 350 rupees a month per parent, against 1,200 to 1,600 Singapore dollars a month for a live-in helper. It scales because one shared number serves every parent and there's no hardware to ship. Next come care centres, insurers and elderly helplines, then Singapore's own elders in Mandarin. Singapore is the customer, India is the parent. Thank you. Now let me show you a real call.

### Demo (~30–60 s, if time allows)

1. Landing page → **Hear tonight's call** section → press play (real Sarvam voice audio, Hindi / Tamil / English).
2. Or play the screen recording of the real call to your phone.
3. One line while it plays: "This is Kin asking about the knee pain from yesterday's call. That's the memory working."

**If short on time:** drop the stats on slide 2 except the first sentence, and the Docker/Coolify line on slide 4.

---

## 3. Q&A answers

### Business model

> The paying customer is the adult child, often working in Singapore or abroad. It's a monthly subscription per parent. My cost is about ₹350, or SGD 5.5, per parent per month, so a planned price of about SGD 12–15, or ₹999 in India, leaves good margin and is still tiny next to a helper. The second channel is B2B: care centres pay per resident for one dashboard, and insurers pay for early-risk signals. The landing page already has waitlists for families, centres and insurers.

*(The price is a plan; say "planned pricing".)*

### How the real-time conversation works

> Before the call, my API sends Sarvam the parent's details as variables: name, language, medicines, and a summary of recent calls. During the call Sarvam streams a loop. Saaras v4 turns speech into text, sarvam-105b picks the reply following my prompt's stages (greeting, wellbeing, medicines, one memory topic, goodbye), and Bulbul speaks it. The agent can use tools: a knowledge base for questions about Kin, an urgent flag, and call transfer to family. When the call ends, Sarvam posts a webhook with the transcript and structured answers (sleep 1–5, mood, medicines taken, pain, concerns). I store them in Postgres, and they become memory for the next call. For inbound calls, Sarvam calls my on-start hook, I look up the caller's number, and I return their profile so Kin greets them by name.

### Cost

**Maths:** 3 min × 30 days = **90 minutes a month**.

| Item | Cost |
|---|---|
| Sarvam voice AI | ₹3.50/min, billed per started minute (confirmed on the first real call: 2:26 → 3 units → ₹10.50) |
| Phone line | ~₹0.40/min |
| One 3-minute call | ~₹11–12 |
| **Per parent per month** | 90 × ₹3.90 ≈ **₹351 ≈ SGD 5.5** |
| Phone number | ₹59/month (launch offer, normally ₹159), shared by all parents |
| Claude summary *(planned, estimate)* | ~₹1–2 per call |
| Server | own VPS via Coolify, shared by all parents *(quote your real bill)* |

> Call length is a per-call setting: 1, 3 or 5 minutes. The prompt sizes the conversation to fit, and a hard cap just under 5 minutes stops one long call from blowing the budget.

**Watch out:** billing is per *started* minute, so a 3:05 call bills as 4 minutes. That's why the prompt keeps calls on time.

### Many people calling the Kin number at once

> Each call is its own Sarvam session, so conversations never mix. On my side, the on-start hook and webhook are stateless endpoints on Postgres, so many calls at once are just many small requests. The real limit is how many lines Sarvam gives one number, which I'm confirming with them. If that's a limit, I add more numbers or move to a Plivo SIP trunk with more channels. Outbound I control myself: the scheduler spreads calls across the evening so they don't all start in the same minute.

*(Don't quote a channel count; "confirming with Sarvam" is the honest answer.)*

### Matching results with one shared number

> Outbound: every call I place gets an `attempt_id` from Sarvam, and the webhook carries it back. Inbound: I match on the caller's number in the on-start hook.

### Edge cases

**Handled today:**
- **Unknown caller:** Kin asks who's calling and shares no health details. These calls are never used as memory.
- **Family member dials Kin:** introduction mode. Kin asks them to merge the parent into the call, and the parent's spoken yes is saved as consent.
- **Voicemail:** a fixed, time-neutral message.
- **Abuse or sexual content:** sexual content ends the call at once; abuse or threats get one warning, then the call ends. This is in the prompt, because Sarvam has no guardrail settings.
- **Emergency words** (fall, chest pain, can't breathe, confusion): Kin says call 108, flags it as urgent, and transfers to family.
- **Database down:** results fall back to a file and are re-imported later. Every raw webhook is stored.
- **Late or old webhooks:** an older call never overwrites newer memory.
- **Try-it demo calls:** these never change a real family's data.
- **Security:** webhooks aren't signed, so a secret token is checked in the payload, not the URL. Secrets live only in server env vars.

**Designed, building next:**
- **No answer or busy:** retry after 20 minutes, then a neighbour or alternate contact, then a missed-call alert in the app. Three days with no answer means red.
- **Wallet:** keep at least ₹200 in the Sarvam wallet, or the number is released on renewal day.

### Scaling

> Voice runs on Sarvam's infrastructure, so I don't run GPUs. My API is stateless in Docker, so I can run more copies. The scheduler claims jobs with `FOR UPDATE SKIP LOCKED`, so multiple workers never call the same parent twice. One number serves every parent. At volume I'd negotiate below ₹3.50 a minute and add Plivo numbers for capacity.

### Likely curveballs

| Question | Answer |
|---|---|
| Is it medical advice? | No. Kin never diagnoses or advises; it notices change and tells the family. For emergencies it says call 108. |
| Privacy and consent? | The parent gives spoken consent themselves. Data sits on my own server. Phone numbers are never read out in calls. |
| Why Sarvam, not OpenAI? | Built for Indian languages and accents, includes an Indian phone line, and has low latency on Indian networks. |
| Parent with dementia or confusion? | Kin repeats back when unsure and stays patient, and confusion itself becomes a signal flagged to the family. |
| Why not WhatsApp? | Many elders can't type or use a smartphone, but everyone answers a call. |
| Regulation? | Consent-based calls to a known person. I'm checking TRAI's do-not-call (NDNC) rules before launch. |
| Why Singapore? | Many Indian families have a child working in Singapore who pays; later, Singapore's own elders in Mandarin and Hokkien via a local partner. |
| What did you build yourself? | Everything, solo: the API, database, Sarvam agent prompt and tools, on-start hook, memory, landing page with real call audio, and the Try-it page that places real calls. |
| Biggest risk? | Elder trust and consent. That's why Kin is introduced by the child on a three-way call and never forced. |

---

## 4. Numbers to remember

- **21%** Singapore aged 65+ in 2026 · **83,000** seniors living alone by 2030
- **347M** Indians aged 60+ by 2050 · **8.8M** living with dementia
- **₹3.50/min** voice + **₹0.40/min** line · **₹11–12** per 3-minute call · **₹350/month** per parent (90 min)
- **S$1,200–1,600/month** for a live-in helper
- **11** Indian languages · first real calls **10 Oct 2026** · number **+91 79714 13869**
