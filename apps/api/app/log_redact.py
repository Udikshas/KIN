"""Keep secrets out of uvicorn's access log."""

import logging
import re

_SECRET_QUERY = re.compile(r"(token=)[^&\s]+")
_SECRET_PATH = re.compile(r"(/ivr/med/)[^/\s?]+")  # the per-call secret in Vobiz callback URLs (app/ivr.py)


class RedactTokenFilter(logging.Filter):
    """Replaces ?token=... in the logged request path with ?token=***."""

    def filter(self, record: logging.LogRecord) -> bool:
        # uvicorn.access args: (client_addr, method, full_path, http_version, status)
        if isinstance(record.args, tuple) and len(record.args) >= 3:
            args = list(record.args)
            args[2] = _SECRET_PATH.sub(r"\1***", _SECRET_QUERY.sub(r"\1***", str(args[2])))
            record.args = tuple(args)
        return True


def redact_access_log() -> None:
    logging.getLogger("uvicorn.access").addFilter(RedactTokenFilter())
