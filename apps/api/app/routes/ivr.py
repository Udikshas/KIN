"""Vobiz callbacks for medicine reminder calls without the AI (app/ivr.py).

GET  /ivr/audio/{key}.wav       the spoken clip (Vobiz fetches it while playing)
POST /ivr/med/{token}/answer    call answered: play the reminder, wait for a key
POST /ivr/med/{token}/digits    the key (1 taken, 2 not now) or none
POST /ivr/med/{token}/hangup    call over: stored like a Sarvam webhook

Vobiz posts form fields. The token in the path is a fresh secret per call, so an
unknown one gets a bare hang-up and nothing is stored.
"""

import json
from urllib.parse import parse_qs

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool

from app import ivr
from app.parents import ProfileError
from app.routes.sarvam import save_payload

router = APIRouter(prefix="/ivr")

XML = "application/xml"
HANG_UP = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'


async def _form(request: Request) -> dict:
    raw = (await request.body()).decode("utf-8", "replace")
    if request.headers.get("content-type", "").startswith("application/json"):
        try:
            data = json.loads(raw or "{}")
            return {k: str(v) for k, v in data.items()} if isinstance(data, dict) else {}
        except ValueError:
            return {}
    return {k: v[0] for k, v in parse_qs(raw).items()}


@router.get("/audio/{key}.wav")
async def audio(key: str):
    data = await run_in_threadpool(ivr.audio, key) if len(key) == 32 else None
    if not data:
        raise HTTPException(status_code=404, detail="no such clip")
    return Response(data, media_type="audio/wav", headers={"Cache-Control": "public, max-age=86400"})


@router.post("/med/{token}/answer")
async def answer(token: str):
    try:
        call = await run_in_threadpool(ivr.call_for, token)
        return Response(await run_in_threadpool(ivr.answer_xml, call) if call else HANG_UP, media_type=XML)
    except ProfileError:
        return Response(HANG_UP, media_type=XML)


@router.post("/med/{token}/digits")
async def digits(token: str, request: Request):
    form = await _form(request)
    try:
        call = await run_in_threadpool(ivr.call_for, token)
        return Response(await run_in_threadpool(ivr.digits_xml, call, form.get("Digits", "")) if call else HANG_UP,
                        media_type=XML)
    except ProfileError:
        return Response(HANG_UP, media_type=XML)


@router.post("/med/{token}/hangup")
async def hangup(token: str, request: Request):
    form = await _form(request)
    try:
        payload = await run_in_threadpool(ivr.finish, token, form)
        if payload:
            await run_in_threadpool(save_payload, payload)
    except ProfileError as e:
        print(f"ivr: hangup not stored ({e})")
    return {"ok": True}
