"""管理员开通/撤销命令行：python -m app.promote_admin <email> [--demote]"""
import argparse
import sys

from app.database import SessionLocal
from app.models import User


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="开通或撤销指定用户的管理员权限")
    parser.add_argument("email", help="目标用户的登录邮箱")
    parser.add_argument("--demote", action="store_true", help="撤销管理员权限（默认为开通）")
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            print(f"错误：用户不存在：{args.email}", file=sys.stderr)
            return 1
        user.is_admin = not args.demote
        db.commit()
        action = "撤销" if args.demote else "开通"
        print(f"已{action}管理员权限：{user.email}（id={user.id}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
