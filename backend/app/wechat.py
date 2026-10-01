from collections.abc import Awaitable, Callable

import httpx
from fastapi import HTTPException, status

from app.config import Settings, get_settings

CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"

Code2SessionFn = Callable[[str, Settings], Awaitable[dict]]


async def code2session(code: str, settings: Settings) -> dict:
    """Exchange a wx.login code for session info via WeChat jscode2session.

    Returns the decoded JSON payload on success. The session_key in the
    payload must never be logged or sent downstream.
    """
    if not settings.wechat_miniapp_appid:
        if settings.debug:
            return {"openid": "dev_" + code[:12]}
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WeChat miniapp login is not configured",
        )

    params = {
        "appid": settings.wechat_miniapp_appid,
        "secret": settings.wechat_miniapp_secret,
        "js_code": code,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CODE2SESSION_URL, params=params)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach WeChat API",
        )

    data = resp.json()
    if data.get("errcode"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"WeChat code2session failed: errcode={data['errcode']}, errmsg={data.get('errmsg', '')}",
        )
    return data


def get_code2session() -> Code2SessionFn:
    return code2session
