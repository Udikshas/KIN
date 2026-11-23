"""Which outbound calls have connected, from Sarvam's on-start hook.

Sarvam reports no ringing and streams nothing during a phone call, but the
on-start hook fires when its agent picks up a connected call. Kept in memory
(single uvicorn worker): after a restart, calls in progress show as "calling"
until their webhook lands.
"""

import threading
import time

FORGET_AFTER_S = 15 * 60

_started: dict[str, float] = {}  # phone -> when the hook last fired for an outbound call
_lock = threading.Lock()


def note_started(phone: str | None) -> None:
    if not phone:
        return
    now = time.time()
    with _lock:
        for p, t in list(_started.items()):
            if now - t > FORGET_AFTER_S:
                del _started[p]
        _started[phone] = now


def connected_since(phone: str | None, placed: float) -> bool:
    """True if a call to `phone` connected after it was placed (a few seconds of slack)."""
    with _lock:
        return bool(phone) and _started.get(phone, 0) >= placed - 5


def forget() -> None:
    """Tests only."""
    with _lock:
        _started.clear()
