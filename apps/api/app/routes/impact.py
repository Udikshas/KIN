"""GET /impact: totals for the website's impact page (kin-web only, X-Web-Token). See app/impact.py."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import impact
from app.parents import ProfileError
from app.web_auth import require_web_token

router = APIRouter(dependencies=[Depends(require_web_token)])


@router.get("/impact")
async def get_impact() -> dict:
    try:
        return await run_in_threadpool(impact.summary)
    except ProfileError as e:
        print(f"impact: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")
