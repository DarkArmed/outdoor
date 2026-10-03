from typing import Annotated

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, get_password_hash, verify_password
from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas import Token, UserLogin, UserOut, UserRegister, WechatLoginIn, WechatLoginOut
from app.wechat import Code2SessionFn, get_code2session

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, hashed_password=get_password_hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/wechat/miniapp", response_model=WechatLoginOut)
async def wechat_miniapp_login(
    payload: WechatLoginIn,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    code2session_fn: Annotated[Code2SessionFn, Depends(get_code2session)],
):
    session_info = await code2session_fn(payload.code, settings)
    openid = session_info["openid"]

    user = db.query(User).filter(User.wechat_openid == openid).first()
    is_new_user = False
    if user is None:
        user = User(
            email=f"wx_{openid}@wechat.local",
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            wechat_openid=openid,
            nickname=payload.nickname or "微信用户",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True
    elif payload.nickname and payload.nickname != user.nickname:
        user.nickname = payload.nickname
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "user": user,
    }
