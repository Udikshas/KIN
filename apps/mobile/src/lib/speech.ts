import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";

// Reading a call aloud with the phone's own voices (AVSpeechSynthesizer on iOS, the
// system text-to-speech on Android): free, offline, nothing sent anywhere. Same idea
// as ReadIt's device narrator: the best installed voice for the language (Enhanced
// first), a different voice for each speaker, and a pitch shift when the phone has
// only one voice for that language.

/** BCP-47 codes for the languages Kin calls in, by English and native name (Call.language). */
const CODES: Record<string, string> = {
  Hindi: "hi-IN", "हिन्दी": "hi-IN",
  Tamil: "ta-IN", "தமிழ்": "ta-IN",
  Malayalam: "ml-IN", "മലയാളം": "ml-IN",
  Bengali: "bn-IN", "বাংলা": "bn-IN",
  Telugu: "te-IN", Kannada: "kn-IN", Marathi: "mr-IN", Gujarati: "gu-IN", Punjabi: "pa-IN", Odia: "or-IN",
  English: "en-IN",
};

export function languageCode(language: string | undefined): string {
  return (language && CODES[language]) || "en-IN";
}

let catalogue: Promise<Speech.Voice[]> | null = null;
const voices = () => (catalogue ??= Speech.getAvailableVoicesAsync().catch(() => []));

/**
 * Installed voices for a language, best first: the same region (en-IN before en-GB),
 * then Enhanced quality, then by name so it is the same voice every time.
 */
async function voicesFor(code: string): Promise<Speech.Voice[]> {
  const base = code.split("-")[0];
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  return (await voices())
    .filter((v) => norm(v.language).split("-")[0] === base)
    .sort(
      (a, b) =>
        Number(norm(b.language) === code.toLowerCase()) - Number(norm(a.language) === code.toLowerCase()) ||
        Number(b.quality === Speech.VoiceQuality.Enhanced) - Number(a.quality === Speech.VoiceQuality.Enhanced) ||
        a.name.localeCompare(b.name),
    );
}

/** Whether the phone can speak this language at all (else read the English). */
export async function canSpeak(code: string): Promise<boolean> {
  if (code.startsWith("en")) return true;
  return (await voicesFor(code)).length > 0;
}

/** One piece to read: `speaker` 0 is Kin (or a plain narrator), 1 is the person on the call. */
export type Part = { text: string; language: string; speaker?: 0 | 1 };

let current: (() => void) | null = null;
let audioReady: Promise<void> | null = null;

/** Play through the speaker even with the silent switch on, like a video would. */
function audioMode() {
  return (audioReady ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix" }).catch(() => {}));
}

/**
 * Reads the parts one after another. `onPart` gets the index being read, `onEnd` fires once
 * when it finishes or is stopped. Starting another reading stops this one. Returns stop().
 */
export function speakParts(parts: Part[], onPart: (i: number) => void, onEnd: () => void): () => void {
  current?.();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (current === stop) current = null;
    void Speech.stop();
    onEnd();
  };
  current = stop;

  const next = async (i: number) => {
    if (stopped) return;
    const part = parts[i];
    if (!part) return stop();
    const pool = await voicesFor(part.language);
    const voice = pool[part.speaker ?? 0] ?? pool[0];
    // Only one voice: the person on the call is the same voice, a little lower.
    const pitch = part.speaker === 1 && !pool[1] ? 0.85 : 1;
    if (stopped) return;
    onPart(i);
    Speech.speak(part.text, {
      language: part.language,
      voice: voice?.identifier,
      pitch,
      rate: 0.95,
      onDone: () => void next(i + 1),
      onError: () => void next(i + 1),
    });
  };

  void audioMode().then(() => next(0));
  return stop;
}

/** Stops whatever is being read (leaving the screen). */
export function stopSpeaking() {
  current?.();
}
