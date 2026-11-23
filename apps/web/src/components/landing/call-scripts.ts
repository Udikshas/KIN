export type Speaker = "kin" | "parent";

export type CallLine = {
  speaker: Speaker;
  said: string;
  english: string;
};

export type CallScript = {
  id: "hi" | "ta" | "en";
  tab: string;
  script: "deva" | "tamil" | "latin";
  parent: string;
  meta: string;
  lines: CallLine[];
  note: { tone: "ok" | "watch" | "alert"; text: string };
};

export const callScripts: CallScript[] = [
  {
    id: "hi",
    tab: "हिन्दी",
    script: "deva",
    parent: "Shanti, 76",
    meta: "Lucknow · Thu 9 Oct · 7:10 pm",
    lines: [
      { speaker: "kin", said: "नमस्ते अम्मा, मैं किन। आज नींद कैसी आई?", english: "Namaste Amma, it's Kin. How did you sleep today?" },
      { speaker: "parent", said: "ठीक थी बेटा… बस घुटने में थोड़ा दर्द है।", english: "It was fine… just a little pain in my knee." },
      { speaker: "kin", said: "कल भी आपने घुटने का बताया था। आज दर्द ज़्यादा है या कम?", english: "You mentioned your knee yesterday too. Is it worse or better today?" },
      { speaker: "parent", said: "थोड़ा ज़्यादा।", english: "A little worse." },
      { speaker: "kin", said: "और नाश्ते के बाद सफ़ेद वाली गोली ली?", english: "And did you take the white tablet after breakfast?" },
      { speaker: "parent", said: "हाँ, ले ली।", english: "Yes, I took it." },
      { speaker: "kin", said: "बहुत अच्छा। नेहा ने आपके लिए एक संदेश रिकॉर्ड किया है…", english: "Wonderful. Neha recorded a message for you…" },
    ],
    note: { tone: "watch", text: "Knee pain mentioned 3 days running. Added to Neha's evening card as something to watch." },
  },
  {
    id: "ta",
    tab: "தமிழ்",
    script: "tamil",
    parent: "Kamala, 74",
    meta: "Chennai · Thu 9 Oct · 6:45 pm",
    lines: [
      { speaker: "kin", said: "வணக்கம் அம்மா, நான் கின். இன்னிக்கு தூக்கம் எப்படி இருந்தது?", english: "Vanakkam Amma, it's Kin. How did you sleep today?" },
      { speaker: "parent", said: "நல்லா இருந்தது… முட்டி கொஞ்சம் வலிக்குது.", english: "It was good… my knee hurts a little." },
      { speaker: "kin", said: "நேத்தும் முட்டி வலின்னு சொன்னீங்க. இன்னிக்கு அதிகமா, குறைவா?", english: "You mentioned knee pain yesterday too. More or less today?" },
      { speaker: "parent", said: "கொஞ்சம் அதிகம்.", english: "A little more." },
      { speaker: "kin", said: "காலை டிபனுக்கு அப்புறம் வெள்ளை மாத்திரை போட்டீங்களா?", english: "Did you take the white tablet after breakfast?" },
      { speaker: "parent", said: "ஆமா, போட்டேன்.", english: "Yes, I took it." },
      { speaker: "kin", said: "ரொம்ப நல்லது. பிரியா உங்களுக்கு ஒரு மெசேஜ் அனுப்பியிருக்காங்க…", english: "Lovely. Priya sent you a message…" },
    ],
    note: { tone: "watch", text: "Knee pain mentioned 3 days running. Added to Priya's evening card as something to watch." },
  },
  {
    id: "en",
    tab: "English",
    script: "latin",
    parent: "Joseph, 79",
    meta: "Bengaluru · Thu 9 Oct · 8:00 pm",
    lines: [
      { speaker: "kin", said: "Good evening, Uncle. It's Kin. How did you sleep last night?", english: "" },
      { speaker: "parent", said: "Not too bad. Woke up twice.", english: "" },
      { speaker: "kin", said: "You said the same on Tuesday. Was it the cough again?", english: "" },
      { speaker: "parent", said: "Yes, a bit of cough.", english: "" },
      { speaker: "kin", said: "Did you take the blue capsule after dinner yesterday?", english: "" },
      { speaker: "parent", said: "I think I forgot.", english: "" },
      { speaker: "kin", said: "That's alright. I'll remind you at nine tonight and let Anita know.", english: "" },
    ],
    note: { tone: "watch", text: "Cough and broken sleep on 2 nights this week, one missed evening dose. Anita gets an amber alert." },
  },
];
