"""Store._write_index 原子写：写一半崩溃不留半截 index.jsonl。"""

import json
from pathlib import Path

import pytest

from store import Store


def _rec(source, ident):
    return {
        "source": source,
        "id": ident,
        "title": "t",
        "keyword": "k",
        "destinations": [],
        "url": "https://example.com",
        "fetched_at": "2026-10-15T08:00:00+08:00",
        "n_images": 0,
        "n_videos": 0,
        "has_fulltext": True,
    }


def test_write_index_leaves_no_tmp(tmp_path):
    store = Store(tmp_path)
    store._index[("s", "1")] = _rec("s", "1")
    store._write_index()
    assert (tmp_path / "index.jsonl").exists()
    assert not list(tmp_path.glob("*.tmp"))


def test_write_index_crash_keeps_old_file(tmp_path, monkeypatch):
    store = Store(tmp_path)
    store._index[("s", "1")] = _rec("s", "1")
    store._write_index()
    before = (tmp_path / "index.jsonl").read_text(encoding="utf-8")

    real_write_text = Path.write_text

    def crash_write(self, data, *args, **kwargs):
        if self.name.endswith(".tmp"):
            real_write_text(self, data[:5], *args, **kwargs)
            raise OSError("simulated crash mid-write")
        return real_write_text(self, data, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", crash_write)
    store._index[("s", "2")] = _rec("s", "2")
    with pytest.raises(OSError):
        store._write_index()
    # 崩溃只影响 tmp 文件，既有索引完整可读
    after = (tmp_path / "index.jsonl").read_text(encoding="utf-8")
    assert after == before
    rows = [json.loads(line) for line in after.splitlines() if line.strip()]
    assert [r["id"] for r in rows] == ["1"]
