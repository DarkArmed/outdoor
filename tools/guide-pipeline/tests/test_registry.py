"""适配器注册表：内置源自注册、新源注册/查找。"""

import pytest

from sources import available_adapters, get_adapter, register_adapter
from sources.base import SourceAdapter


def test_builtin_adapters_registered():
    for name in ("weibo", "ctrip", "xhs", "visitbeijing"):
        assert name in available_adapters()
    assert get_adapter("visitbeijing").source == "visitbeijing"


def test_register_and_lookup():
    class DummyAdapter(SourceAdapter):
        source = "dummy-test"

        def search(self, keyword):
            return []

        def fetch(self, ref):
            raise NotImplementedError

    register_adapter("dummy-test", DummyAdapter)
    assert get_adapter("dummy-test") is DummyAdapter
    assert "dummy-test" in available_adapters()


def test_unknown_adapter_error():
    with pytest.raises(KeyError):
        get_adapter("no-such-source")
