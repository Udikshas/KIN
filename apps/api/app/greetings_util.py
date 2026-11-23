"""Pick and fill Kin's opening line (see app/greetings.py, generated)."""

import re

from app.greetings import GREETINGS

# Kin says it is an AI before anything else is asked: on every call to a parent
# who has not yet said yes to Kin's calls, and to every unknown caller.
# Hand-written; worth a native speaker's check before relying on them.
AI_DISCLOSURE = {
    "English": "I am an AI assistant, not a person.",
    "Hindi": "मैं एक AI सहायक हूँ, इंसान नहीं।",
    "Bengali": "আমি একজন AI সহকারী, মানুষ নই।",
    "Tamil": "நான் ஒரு AI உதவியாளர், மனிதர் அல்ல.",
    "Telugu": "నేను ఒక AI సహాయకురాలిని, మనిషిని కాదు.",
    "Kannada": "ನಾನು ಒಂದು AI ಸಹಾಯಕಿ, ಮನುಷ್ಯಳಲ್ಲ.",
    "Malayalam": "ഞാൻ ഒരു AI സഹായിയാണ്, മനുഷ്യനല്ല.",
    "Marathi": "मी एक AI सहाय्यक आहे, माणूस नाही.",
    "Gujarati": "હું એક AI સહાયક છું, માણસ નથી.",
    "Punjabi": "ਮੈਂ ਇੱਕ AI ਸਹਾਇਕ ਹਾਂ, ਇਨਸਾਨ ਨਹੀਂ।",
    "Odia": "ମୁଁ ଜଣେ AI ସହାୟକ, ମଣିଷ ନୁହେଁ।",
}
_SENTENCES = re.compile(r"(?<=[.।!?])\s+")


def language_or_default(language: str | None) -> str:
    return language if language in GREETINGS else "Hindi"


def _with_disclosure(line: str, language: str) -> str:
    *before, last = _SENTENCES.split(line)
    return " ".join([*before, AI_DISCLOSURE.get(language, AI_DISCLOSURE["English"]), last])


def opening_line(kind: str, language: str | None, name: str = "", family: str = "", disclose: bool = False) -> str:
    """The greeting; with disclose, Kin says it is an AI just before the closing question."""
    language = language_or_default(language)
    line = GREETINGS[language][kind].format(name=name or "ji", family=family or "family")
    return _with_disclosure(line, language) if disclose else line


# Introduction calls: a family member rings Kin, then merges the parent in.
# Hand-written (not generated): Hindi and English; other languages use English,
# and the agent switches as soon as the parent speaks.
INTRODUCTION = {
    "Hindi": "नमस्ते {family}, मैं Kin बोल रही हूँ। {name} को कॉल में जोड़ लीजिए, फिर मैं अपना परिचय दूँगी।",
    "English": "Namaste {family}, this is Kin. Please add {name} to the call, and I will introduce myself.",
}


def introduction_line(language: str | None, name: str = "", family: str = "") -> str:
    line = INTRODUCTION.get(language_or_default(language), INTRODUCTION["English"])
    return line.format(name=name or "ji", family=family or "ji")


# Medicine reminder calls (app/reminders.py): straight to the point, one short call.
# Hand-written, Hindi and English; other languages open with their usual greeting and
# the agent (call_mode = medicine_reminder) asks about the medicines in their language.
REMINDER = {
    "Hindi": "नमस्ते {name}, मैं Kin बोल रही हूँ। दवाई का समय हो गया है: {medicines}। क्या आपने ले ली?",
    "English": "Namaste {name}, this is Kin. It is time for your medicine: {medicines}. Have you taken it?",
}


def reminder_line(language: str | None, name: str, medicines: str, time_of_day: str, family: str = "", disclose: bool = False) -> str:
    lang = language_or_default(language)
    if lang not in REMINDER:
        return opening_line(f"outbound_{time_of_day}", lang, name, family, disclose)
    line = REMINDER[lang].format(name=name or "ji", medicines=medicines)
    return _with_disclosure(line, lang) if disclose else line
