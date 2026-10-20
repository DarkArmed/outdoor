"""corpus-root 缺省解析：--corpus-root 参数 > 环境变量 CORPUS_ROOT > 仓库根 corpus/。

select.py / validate.py 共用。worktree 里仓库根没有 corpus/（语料在主检出且 gitignore），
缺省解析失败时报错并说明指定方式。
"""
import os
import sys
from pathlib import Path

sys.stderr.reconfigure(encoding='utf-8')


def repo_root():
    return Path(__file__).resolve().parents[2]


def resolve(arg):
    """返回语料库根 Path；找不到时打印清晰报错并 exit 1。"""
    env = os.environ.get('CORPUS_ROOT')
    if arg:
        cand, origin = arg, '--corpus-root 参数'
    elif env:
        cand, origin = env, '环境变量 CORPUS_ROOT'
    else:
        cand, origin = str(repo_root() / 'corpus'), '缺省（仓库根 corpus/）'
    p = Path(cand)
    if not (p / 'index.jsonl').is_file():
        sys.stderr.write(
            f'错误：语料库不可用（缺 index.jsonl）：{p}（来源：{origin}）\n'
            '指定语料库位置（优先级从高到低）：\n'
            '  1. 命令行 --corpus-root <路径>\n'
            '  2. 环境变量 CORPUS_ROOT\n'
            '  3. 仓库根下的 corpus/ 目录\n'
            '提示：语料库 gitignore，只在仓库主检出；在 worktree 中运行请显式指向主检出，\n'
            '      例如 --corpus-root C:/Repos/outdoor/corpus\n'
        )
        raise SystemExit(1)
    return p
