"""事件总线：JsonlSink 行格式与历史批次兼容、支持注册额外 sink。"""

import json

from events import EventBus, JsonlSink


def test_jsonl_sink_format_compatible(tmp_path):
    path = tmp_path / "batch" / "events.jsonl"
    bus = EventBus([JsonlSink(path)])
    bus.emit("search", "xhs", keyword="白河湾")
    bus.emit("saved", "xhs", id="abc123")
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert [r["event"] for r in rows] == ["search", "saved"]
    for row in rows:
        assert set(row) >= {"time", "event", "source"}
        assert row["source"] == "xhs"
    assert rows[0]["keyword"] == "白河湾"


def test_extra_sink_registration(tmp_path):
    collected = []
    bus = EventBus([JsonlSink(tmp_path / "events.jsonl")])
    bus.add_sink(collected.append)  # 演示：后续 worker 可挂 DB sink，事件本体不变
    bus.emit("detail_attempt", "weibo", id="1")
    assert collected == bus.history
    assert collected[0]["event"] == "detail_attempt"
