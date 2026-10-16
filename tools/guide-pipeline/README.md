# 攻略流水线（guide-pipeline）

> 状态：原文采集工具已落地；进度保存在本地索引与采集记录中。

从内容平台采集户外攻略**原文**（文字 + 图片 + 视频）到本地语料库 `corpus/`。

- 需求：[PRD-006-攻略语料采集](../../docs/prd/PRD-006-攻略语料采集.md)
- 选型理由：[ADR-006-攻略语料采集方式](../../docs/adr/ADR-006-攻略语料采集方式.md)
- 设计与机制（数据源可行性、存储格式、采集策略）：[docs/tech/攻略流水线](../../docs/tech/攻略流水线.md)
- 进度查询与续采：[持续采集：进度入口与续采](../../docs/tech/攻略流水线.md#七持续采集进度入口与续采)

普通采集按技术文档第五节运行；本地扩采批次的记录和运行限制见第七节。文档维护查询方法与操作约定，不逐轮抄录采集数量。

## 采集保护机制（INV-001 操作规则收编核心）

调研期验证过的保护机制已从临时批次脚本收编进核心（`budget.py` / `events.py`），每次运行自动生效：

- **会话预算**：当日 `search + detail_attempt` 请求数合计达到 `config.json` 的 `session_budget`（默认 25）即主动收工，事件 `stopped reason=budget_stop`。永不撞墙，次日窗口再跑。
- **3 连空搜索保守暂停**：同一源连续 3 次空搜索结果 → 按 `SourceBlocked` 处理（原因未确认，不对抗），当日不再启动该源。
- **当日 blocked 拒跑**：启动前扫描 `corpus/collection/*/events.jsonl` 的当日事件，该源已有 `blocked` 记录即拒跑（`stopped reason=source_paused_for_today`）。
- **原子索引**：`index.jsonl` 一律 tmp + replace 原子写，写一半崩溃不留半截文件。

## 事件总线

`events.py` 的 `EventBus.emit(event, source, **data)` 统一发射事件；默认 sink 写 `corpus/collection/pipeline-<MMDD-HHMM>/events.jsonl`（逐行 JSON，格式与历史批次脚本一致，既有分析工具可直接读）。`add_sink` 可注册额外 sink（后续 worker 挂 DB sink 用，见 `tests/test_events.py` 示例）。

## 源适配器注册表

`sources/__init__.py` 维护注册表：`register_adapter(name, cls)` 注册、`get_adapter(name)` 查找；内置源（weibo/ctrip/xhs/visitbeijing）在该文件自注册，新增源不动 `pipeline.py` 入口代码。其中 **visitbeijing**（北京旅游网，官方源）由批次脚本转正：`search()` 不触网，从 `config.json` 的 `visitbeijing.queue`（`{id, url, name, keywords?}`）按关键词匹配待采页面，`fetch()` 抓详情页并把原始 HTML 存为条目下的 `source.html`。

## corpus 路径覆盖

默认语料根目录为「仓库根/corpus」（按 `pipeline.py` 位置推导；在 worktree 中运行会解析到 worktree 内的 `corpus/`，属预期）。覆盖优先级：环境变量 `GUIDE_PIPELINE_CORPUS_ROOT` > `config.json` 的 `corpus_root` > 默认值。采真实语料时：

```bash
GUIDE_PIPELINE_CORPUS_ROOT=C:/Repos/outdoor/corpus python pipeline.py --source weibo --keyword 白河湾
```

## 测试

```bash
python -m pytest tools/guide-pipeline/tests -q   # 需本目录 requirements + pytest；不触网、不触真实 corpus
```

