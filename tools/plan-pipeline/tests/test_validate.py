import json
import sys
from pathlib import Path

import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

import corpus_root
import validate


EXPECTED_SLUGS = {
    'labagoumen',
    'huanghuacheng',
    'yinshatalin',
    'yudushan',
    'jingxigudao',
}


def make_valid_plan():
    return {
        'id': 'derived-test',
        'archived': True,
        'badge': {'icon': '🥾', 'name': '测试徽章'},
        'tasks': ['任务一', '任务二', '任务三'],
        'title': '测试方案',
        'date': '备用',
        'type': 'B 山野徒步',
        'theme': 'hike',
        'emoji': '🥾',
        'location': '怀柔·测试地',
        'drive': {
            'from': '家',
            'to': '测试地',
            'time': '单程约 1 小时',
            'km': 90,
            'landmarks': ['测试地标'],
        },
        'goal': '测试目标',
        'tips': ['测试提示'],
        'itinerary': [{'time': '08:00', 'text': '出发'}],
        'gear': {'base': ['徒步鞋'], 'special': ['急救包']},
        'safety': ['注意安全'],
        'hike': None,
        'review': ['问题一', '问题二', '问题三', '问题四'],
    }


@pytest.fixture(autouse=True)
def clear_findings():
    validate.errors.clear()
    validate.warnings.clear()
    yield
    validate.errors.clear()
    validate.warnings.clear()


@pytest.fixture(scope='module')
def corpus_and_drafts():
    try:
        corpus = corpus_root.resolve(None)
    except SystemExit:
        pytest.skip('需要本地语料库；请通过 CORPUS_ROOT 指定主检出 corpus/')
    drafts = {}
    for slug in sorted(EXPECTED_SLUGS):
        path = corpus / 'derived' / f'{slug}.draft.json'
        if not path.is_file():
            pytest.fail(f'缺少现有 draft：{path}')
        drafts[slug] = json.loads(path.read_text(encoding='utf-8'))
    return corpus, drafts


@pytest.mark.parametrize('mutation', [
    lambda plan: plan.update(safety='注意安全'),
    lambda plan: plan['gear'].update(base='徒步鞋'),
    lambda plan: plan.update(tasks=[{'text': '任务一'}, {'text': '任务二'}, {'text': '任务三'}]),
], ids=['safety-string', 'gear-base-string', 'tasks-three-objects'])
def test_contract_rejects_invalid_field_types(mutation):
    plan = make_valid_plan()
    mutation(plan)

    validate.check_contract(plan)

    assert validate.errors, '错误结构必须被数据契约校验拒绝'


def test_current_draft_plans_pass_contract(corpus_and_drafts):
    _, drafts = corpus_and_drafts

    for draft in drafts.values():
        validate.check_contract(draft['plan'])

    assert validate.errors == []


@pytest.mark.parametrize('value, expected', [
    ('https://example.com/not-a-destination', '出现 URL'),
    ('小红书', '出现平台名: 小红书'),
], ids=['drive-to-url', 'drive-to-platform'])
def test_compliance_scans_drive_strings(value, expected):
    plan = make_valid_plan()
    plan['drive']['to'] = value

    validate.check_compliance(plan, Path('.'), {})

    assert any(expected in error for error in validate.errors)
    assert '90' not in validate.plan_strings(plan), '数字 drive.km 不应进入文本扫描'


def test_current_draft_plans_pass_compliance_including_drive(corpus_and_drafts):
    corpus, drafts = corpus_and_drafts

    for draft in drafts.values():
        validate.check_compliance(draft['plan'], corpus, drafts)

    assert validate.errors == []
