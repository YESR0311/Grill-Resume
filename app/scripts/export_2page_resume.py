import json
import urllib.parse
import urllib.request
from pathlib import Path

root = Path('/home/yesr/projects/aaa/rmx/简历/app')
doc = json.loads((root / '.backend-coach-document.json').read_text())

doc['basics']['targetRole'] = '市场营销实习 / 产品运营实习'
doc['basics']['city'] = '北京 / 石家庄'
doc['target'] = {'role': '市场营销实习 / 产品运营实习', 'industry': '期望薪资：6-8K｜期望城市：北京 / 石家庄', 'keywords': []}
doc['summary'] = {
    'headline': '国际经济与贸易本科，具备外贸跟单、用户运营、商务分析与 AI Agent 工作流实践；求职方向聚焦市场营销实习、产品运营实习。',
    'bullets': [
        {'id': 'summary-1', 'text': '运营侧能按“用户分层-触达促活-留存转化-反馈复盘”拆解执行：曾通过校园社群、微信私聊、地推与老带新触达 100+ 目标用户，推动 8 人试听、3 人报名，并将社群日活跃率由 20% 提升至 30%。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
        {'id': 'summary-2', 'text': '工具侧能把 Word/PPT/Excel 与 LLM 工作流结合：用于商务文书、案例汇报、销售物流数据汇总、周报生成和案例分析，具备从需求拆解、流程编排到本地验证的完整执行意识。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
    ],
}

for exp in doc['experiences']:
    if exp['id'] == 'exp-syd':
        exp['bullets'] = [
            {'id': 'b-syd-1', 'text': '搭建「日期-客户简称-单据类型-版本号」命名规范，覆盖形式发票、销售合同、装箱单与报关单据等核心文件，累计规范整理 100+ 份单据，将团队平均检索时间由 5 分钟缩短至 3.5 分钟内，效率提升约 30%。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
            {'id': 'b-syd-2', 'text': '协助对接 5 位东南亚及欧洲客户邮件往来，使用中英双语完成报价确认、订单跟进与异常反馈，跨 6–7 小时时差推进 20+ 笔国际贸易订单跟单与对账，核对订单金额、物流节点与付款状态。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
            {'id': 'b-syd-3', 'text': '搭建「Excel + AI Agents」周度数据工作流，使用透视表与函数完成 300+ 条销售与物流数据汇总，借助 AI 完成异常订单识别、数据清洗与周报初稿撰写，将周报产出时间由半天缩短至 3 小时内。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
        ]
    elif exp['id'] == 'exp-zy':
        exp['role'] = '用户运营/校园大使实习生'
        exp['bullets'] = [
            {'id': 'b-zy-1', 'text': '通过校园社群、微信私聊、地推、老带新推介与校园活动等渠道开发目标客户，1 个月内触达 100+ 名目标用户，新增有效微信好友 20+，推动 8 人咨询/试听、3 人报名转化。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
            {'id': 'b-zy-2', 'text': '维护 20+ 名意向客户关系，使用 Excel 与微信标签建立用户档案，记录年级、课程需求、意向强度、跟进状态与来源渠道，结合 AI 工具整理咨询记录和需求摘要，实现一对一产品推荐。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
            {'id': 'b-zy-3', 'text': '通过微信私聊、社群互动与试听回访收集 20+ 条反馈，整理 Excel 反馈台账与 FAQ，基于 A/B/C 用户分层提出话术和社群活动建议，其中 2 条被采纳，助推社群日活跃率由 20% 提升至 30%。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
        ]
    elif exp['id'] == 'exp-tuanwei':
        exp['bullets'] = [
            {'id': 'b-tw-1', 'text': '参与撰写、修改 10+ 份讲稿、活动策划、函件请示与考核材料，覆盖石榴籽开班仪式、表彰大会、团日活动、团建活动与青马工程等场景；同步更新 20+ 个二级团组织团干部数据，协助 6+ 场校级活动会务布置与流程协调。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'},
        ]

projects = []
for project in doc['projects']:
    if project['id'] == 'proj-transsion':
        project['bullets'] = [{'id': 'b-transsion-1', 'text': '与中非籍、埃塞俄比亚籍国际商务硕士生组成三人英文团队，围绕传音控股东非市场生态化转型开展案例研究，主导英文资料研读、SWOT/PESTEL 分析、英文报告与展示 PPT 撰写，并参与全英文展示与 Q&A，获院级团队优秀奖。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'}]
        projects.append(project)
    elif project['id'] == 'proj-ai-agents':
        project['bullets'] = [{'id': 'b-ai-1', 'text': '围绕“AI 提升学习与职业生产力”主导 3 个本地 Agent 工作流项目：简历 Agent 打通素材问答、证据沉淀、多版 bullet 与 DOCX 输出；PPT Agent 支持结构化 deck.json、模板化生成与 PPTX 导出；学术工作流支持文献/材料整理、研究问题拆解与案例分析报告草稿。本人负责需求设计、流程编排与测试验证，AI 辅助部分代码实现。', 'sourceEvidenceIds': [], 'qualityFlags': [], 'status': 'confirmed'}]
        projects.append(project)
doc['projects'] = projects

doc['skills'] = [
    {'id': 'skill-office-ai', 'category': 'tools', 'name': '工具与 AI 工作流', 'items': ['Word 商务文书/讲稿/函件撰写', 'PPT 案例汇报结构设计', 'Excel 透视表/函数/可视化', 'Prompt Engineering', 'AI Agent 流程编排']},
    {'id': 'skill-business', 'category': 'soft_skills', 'name': '运营/营销/贸易', 'items': ['用户分层', '拉新-促活-留存-转化', 'FAQ 与话术优化', 'SWOT/PESTEL 分析', '外贸单据整理', '英文邮件与订单跟进']},
    {'id': 'skill-language', 'category': 'human_languages', 'name': '语言能力', 'items': ['CET-6', 'CET-4', '英文资料研读', '英文展示与 Q&A']},
]
doc['metadata']['updatedAt'] = '2026-05-25T13:20:00.000Z'
(root / '.backend-coach-document-2page.json').write_text(json.dumps(doc, ensure_ascii=False), encoding='utf-8')
(root / '.backend-coach-document.json').write_text(json.dumps(doc, ensure_ascii=False), encoding='utf-8')

out = Path('/home/yesr/projects/aaa/rmx/简历/1.docx')
payload = {'document': doc, 'partialMode': True}
request = urllib.request.Request('http://127.0.0.1:3000/api/backend-docx', data=json.dumps(payload, ensure_ascii=False).encode(), headers={'content-type': 'application/json'})
with urllib.request.urlopen(request, timeout=60) as response:
    data = response.read()
    report = urllib.parse.unquote(response.headers.get('x-gap-report', ''))
out.write_bytes(data)
print(json.dumps({'path': str(out), 'bytes': len(data), 'report': json.loads(report) if report else None}, ensure_ascii=False, indent=2))
