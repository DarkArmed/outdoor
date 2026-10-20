"""源适配器注册表：内置源在此自注册。

新增源只需 register_adapter(name, cls)（可在本文件追加一行，或任何被导入的模块里
调用），pipeline.py 入口代码不动。
"""

from __future__ import annotations

_REGISTRY: dict[str, type] = {}


def register_adapter(name: str, cls: type) -> None:
    _REGISTRY[name] = cls


def get_adapter(name: str) -> type:
    try:
        return _REGISTRY[name]
    except KeyError:
        raise KeyError(f"未注册的采集源: {name}（可选: {available_adapters()}）") from None


def available_adapters() -> list[str]:
    return sorted(_REGISTRY)


# 内置源自注册
from .ctrip import CtripAdapter  # noqa: E402
from .visitbeijing import VisitbeijingAdapter  # noqa: E402
from .weibo import WeiboAdapter  # noqa: E402
from .xhs import XhsAdapter  # noqa: E402

for _cls in (WeiboAdapter, CtripAdapter, XhsAdapter, VisitbeijingAdapter):
    register_adapter(_cls.source, _cls)
