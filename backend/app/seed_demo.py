"""Explicit, repeatable local demo; never creates users or imports private files."""
from app.config import get_settings
from app.database import SessionLocal
from app.models import Plan

DEMO_ID = "2026-10-04_container-demo"


def seed_demo():
    if not get_settings().enable_demo_data:
        raise RuntimeError("Demo data requires ENABLE_DEMO_DATA=true")
    with SessionLocal.begin() as db:
        if db.get(Plan, DEMO_ID) is None:
            db.add(Plan(
                id=DEMO_ID,
                title="容器验证示例（虚构）",
                date="10/04",
                type="A",
                theme="hike",
                emoji="🥾",
                location="虚构公园",
                goal="仅用于验证部署、清单与打卡，不是实际活动计划。",
                tips=["全部信息为虚构测试数据。"],
                drive={"from": "家", "to": "虚构公园", "time": "20分钟", "km": 5},
                hike={"title": "虚构步道", "km": 1},
                gear={"base": ["测试背包", "测试饮水"], "special": []},
                tasks=["确认测试清单"],
                safety=["本数据不可用于实际出行。"],
                review=["完成本机部署验证"],
                badge={"icon": "🥾", "name": "测试徽章"},
            ))
    print("Demo plan available; no accounts or private data imported.")


if __name__ == "__main__":
    seed_demo()
