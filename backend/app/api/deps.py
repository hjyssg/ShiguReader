from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from app.core.db import engine
from app.models import User


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]


def get_current_user(session: SessionDep) -> User:
    user = session.exec(select(User).order_by(User.created_at.asc())).first()
    if not user:
        raise HTTPException(
            status_code=503,
            detail="No user available. Please initialize data first.",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
