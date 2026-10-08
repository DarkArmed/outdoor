# 语料转方案流水线（tools/plan-pipeline/）

把 `corpus/` 语料库中的真实攻略转换为系统可用的出行方案（`data/data-e.js` 备用计划条目）。
权威规格：[`docs/tech/语料转方案.md`](../../docs/tech/语料转方案.md)（数据契约 §四、实施步骤 §五、验证目标 §六）；需求 PRD-007、选型 ADR-007。

## 流程与命令

```
① 选料（工具）   别名集 + 语料库 → 证据包 bundle JSON
② 提取（agent）  读证据包 → 写 draft JSON（corpus/derived/<slug>.draft.json，status=draft）
③ 审校（agent+用户）事实/强度/安全/原创性复核 → status=reviewed
④ 落盘（工具）   reviewed draft → data/data-e.js 追加 PLANS 条目 → status=emitted
⑤ 校验（工具）   dump-data 解析 + 契约字段 + 原创性/合规检查
```

每步一条命令示例：

```bash
# ① 选料：证据包写到 corpus/derived/（别覆盖已有 bundle）
python tools/plan-pipeline/select.py --dest 喇叭沟门 --aliases 喇叭沟门,喇叭沟,喇叭沟原始森林 \
    --corpus-root C:/Repos/outdoor/corpus --out C:/Repos/outdoor/corpus/derived/labagoumen.bundle.json

# ② 提取：agent 读 bundle，按规格 §4.2 schema 写 corpus/derived/<slug>.draft.json（无命令）

# ③ 审校：agent + 用户复核 draft，事实/强度保守/安全/原创重写，改后 status 置 reviewed（无命令）

# ④ 落盘：幂等，同 id 跳过；成功后 draft 自动置 emitted
python tools/plan-pipeline/emit.py --draft C:/Repos/outdoor/corpus/derived/labagoumen.draft.json

# ④' 回归校验：draft.plan 与 data-e.js 同 id 条目序列化等价（不写文件，不等价退出码 1）
python tools/plan-pipeline/emit.py --check --draft C:/Repos/outdoor/corpus/derived/labagoumen.draft.json

# ⑤ 校验：契约 + 合规；--strict 时警告也算失败
python tools/plan-pipeline/validate.py --corpus-root C:/Repos/outdoor/corpus
```

落盘后由现有链接消费：`node tools/dump-data.js` → `backend/app/seed.py` → API → 页面备用计划区。

## corpus-root 解析规则

`select.py` / `validate.py` 的语料库定位优先级：

1. `--corpus-root <路径>` 参数
2. 环境变量 `CORPUS_ROOT`
3. 仓库根下的 `corpus/` 目录

三者都找不到（缺 `index.jsonl`）时报错并打印上述指定方式。语料库 gitignore、只在仓库主检出，**在 worktree 中运行必须显式指向主检出**，如 `--corpus-root C:/Repos/outdoor/corpus`。

## 读写红线

- `corpus/raw/**` **只读**——工具一个字节都不许改；
- `corpus/derived/*.draft.json`、`*.bundle.json` 是工作文件，可写（emit 成功会回填 status）；
- 语料引用（source+id）只存在于 draft，**不得进入 data/data-e.js**；方案文字必须原创重写（validate.py 做 n-gram 重合与平台名/URL/作者名检查）。

## 文件

| 文件 | 作用 |
|---|---|
| `select.py` | ① 选料：索引 + 全文检索，按源优先级/互动数据/命中权重排序出证据包 |
| `emit.py` | ④ 落盘：draft.plan → `data/data-e.js`（幂等）；`--check` 回归校验 |
| `validate.py` | ⑤ 校验：契约字段 + §4.4 禁止项 |
| `corpus_root.py` | corpus-root 缺省解析（select/validate 共用） |
| `jsfmt.js` | JS 对象 ↔ 源码/JSON 转换（node vm 解析 data 文件；序列化风格与 data/*.js 一致） |
