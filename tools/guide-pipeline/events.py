"""事件总线：统一的事件发射接口（机制收编自批次脚本 collect.py 的 event()）。

事件类型与历史批次脚本保持一致（search/search_results/detail_attempt/saved/failed/
blocked/stopped 等），行格式不变：{"time", "event", "source", ...} 逐行 JSON，
默认 sink 追加写 corpus/collection/<运行批次>/events.jsonl，既有分析工具可直接读。
后续 worker 可通过 add_sink 挂 DB sink，事件本体不变。
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Callable

from sources.base import now_iso

Sink = Callable[[dict], None]


class JsonlSink:
    """默认 sink：逐行 JSON 追加写 events.jsonl（多线程安全）。"""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def __call__(self, row: dict) -> None:
        line = json.dumps(row, ensure_ascii=False) + "\n"
        with self._lock:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(line)


class EventBus:
    """发射事件到全部已注册 sink，并保留本轮内存历史（供预算计量）。"""

    def __init__(self, sinks: list[Sink] | None = None):
        self._sinks: list[Sink] = list(sinks or [])
        self.history: list[dict] = []

    def add_sink(self, sink: Sink) -> None:
        self._sinks.append(sink)

    def emit(self, event: str, source: str, **data) -> dict:
        row = {"time": now_iso(), "event": event, "source": source, **data}
        self.history.append(row)
        for sink in self._sinks:
            sink(row)
        return row
