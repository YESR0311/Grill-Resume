import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  type: 'polish_full' | 'polish_sentence';
  content: string;
  industry: string;
  style?: 'standard' | 'data' | 'expert';
}

interface IndustryConfig {
  name: string;
  dimensions: string[];
  expertModeName: string;
  expertStrategy: string;
  dataPlaceholders: string[];
}

const INDUSTRY_CONFIG: Record<string, IndustryConfig> = {
  programmer: {
    name: '技术/程序员',
    dimensions: ['算法基础', '系统架构', '工程质量', '技术广度', '业务理解', '影响力'],
    expertModeName: '架构思维与技术壁垒版',
    expertStrategy: '强调高并发处理、系统稳定性、源码级理解、技术选型决策。突出对底层原理的掌握和架构设计的经验。',
    dataPlaceholders: ['[QPS 提升了 X%]', '[延迟降低了 Yms]', '[Crash率降低至 Z%]', '[节省服务器成本 W%]'],
  },
  devops: {
    name: '运维/SRE',
    dimensions: ['自动化运维', '系统稳定性', '云原生技术', '成本控制', '故障响应', '安全合规'],
    expertModeName: 'SRE 体系与稳定性建设版',
    expertStrategy: '强调 SLA/SLO 承诺、CI/CD 流水线效率、容器化编排 (K8s)、可观测性建设、以及降本增效。',
    dataPlaceholders: ['[系统可用性 (SLA) 提升至 99.99%]', '[部署效率提升 X%]', '[云资源成本降低 Y%]', '[故障恢复时间 (MTTR) 缩短 Z分钟]'],
  },
  security: {
    name: '网络安全',
    dimensions: ['漏洞挖掘', '防御架构', '应急响应', '合规审计', '渗透测试', '安全开发'],
    expertModeName: '零信任架构与攻防对抗版',
    expertStrategy: '强调主动防御体系、SDL (安全开发生命周期)、等级保护/GDPR 合规、以及攻防演练战果。',
    dataPlaceholders: ['[修复高危漏洞 X个]', '[拦截恶意攻击 Y万次]', '[安全审计通过率 100%]', '[应急响应速度缩短至 Z分钟]'],
  },
  qa: {
    name: '测试工程师',
    dimensions: ['测试策略', '自动化覆盖', '缺陷分析', '性能测试', '持续集成', '用户视角'],
    expertModeName: '质量效能与自动化体系版',
    expertStrategy: '强调测试左移 (Shift Left)、精准测试、自动化覆盖率提升、以及对线上质量 (线上故障率) 的保障。',
    dataPlaceholders: ['[自动化测试覆盖率达到 X%]', '[线上故障率降低 Y%]', '[回归测试周期缩短 Z天]', '[发现核心性能瓶颈 W个]'],
  },
  pm: {
    name: '产品经理',
    dimensions: ['商业洞察', '用户体验', '数据分析', '项目管理', '沟通协调', '战略规划'],
    expertModeName: '商业闭环与产品战略版',
    expertStrategy: '强调 ROI（投资回报率）、GTM（上市策略）、Roadmap 规划、从 0 到 1 的破局能力。体现商业思维和战略视野。',
    dataPlaceholders: ['[DAU 提升了 X%]', '[用户留存率 +Y%]', '[转化率提升 Z%]', '[带来营收 W万]'],
  },
  designer: {
    name: 'UI/UX设计师',
    dimensions: ['视觉表现', '交互逻辑', '用户同理心', '设计规范', '品牌理解', '工具效率'],
    expertModeName: '设计思维与用户体验版',
    expertStrategy: '强调 Design System（设计系统）的搭建、全链路设计、品牌一致性、设计对数据的赋能。',
    dataPlaceholders: ['[点击率 (CTR) 提升 X%]', '[改稿效率提升 Y%]', '[用户满意度 (NPS) +Z]', '[任务完成时间缩短 W%]'],
  },
  analyst: {
    name: '数据分析师',
    dimensions: ['统计学基础', '建模能力', '业务洞察', '数据可视化', 'SQL/Python', '决策支持'],
    expertModeName: '商业智能与决策驱动版',
    expertStrategy: '强调从数据中发现机会、归因分析、预测模型精准度、对战略决策的直接支撑。',
    dataPlaceholders: ['[预测准确率达到 X%]', '[发现潜在营收机会 Y万]', '[报表自动化节约 Z小时/周]'],
  },
  marketing: {
    name: '市场/运营',
    dimensions: ['获客能力', '内容创意', '活动策划', '数据复盘', '渠道管理', '品牌建设'],
    expertModeName: '增长黑客与品牌操盘版',
    expertStrategy: '强调低成本获客、漏斗转化优化、私域流量运营、品牌声量引爆。',
    dataPlaceholders: ['[ROI 达到 1:X]', '[获客成本 (CAC) 降低 Y%]', '[全网曝光量 Z万+]', '[GMV 增长 W%]'],
  },
  sales: {
    name: '销售',
    dimensions: ['客户开发', '谈判技巧', '业绩达成', '渠道拓展', '客户维系', '销售管理'],
    expertModeName: '销冠策略与大客攻坚版',
    expertStrategy: '强调 KA 大客户攻单、销售漏斗管理、超额完成率、年度复合增长。',
    dataPlaceholders: ['[业绩达成率 X%]', '[年度销售额 Y万]', '[签约行业头部客户 Z家]', '[回款率 W%]'],
  },
  hr: {
    name: '人力资源',
    dimensions: ['招聘配置', '组织发展', '薪酬绩效', '员工关系', '企业文化', '流程合规'],
    expertModeName: '组织效能与人才战略版',
    expertStrategy: '强调 OD（组织发展）、人才梯队建设、人效提升、合规风险控制。',
    dataPlaceholders: ['[招聘周期缩短 X天]', '[员工满意度提升 Y%]', '[核心人才流失率降低 Z%]', '[人效提升 W%]'],
  },
  accountant: {
    name: '会计/财务',
    dimensions: ['财务分析', '风险控制', '税务筹划', '合规准则', '资金管理', '报表效率'],
    expertModeName: 'CFO 视角与财务战略版',
    expertStrategy: '强调业财融合、现金流优化、审计合规率、税务风险规避及对经营决策的数据支撑。',
    dataPlaceholders: ['[税务成本节约 X万]', '[月结耗时缩短 Y天]', '[审计一次通过率 100%]', '[资金周转率提升 Z%]'],
  },
};

function getConfig(industry: string): IndustryConfig {
  return INDUSTRY_CONFIG[industry] || INDUSTRY_CONFIG.programmer;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, content, industry, style } = await req.json() as RequestBody;
    const SILICONFLOW_API_KEY = Deno.env.get('SILICONFLOW_API_KEY');
    const SILICONFLOW_MODEL = Deno.env.get('SILICONFLOW_MODEL') || 'Qwen/Qwen3-8B';
    
    if (!SILICONFLOW_API_KEY) {
      throw new Error('SILICONFLOW_API_KEY is not configured');
    }

    const config = getConfig(industry);

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'polish_full') {
      systemPrompt = `你是一位专业的简历优化专家，精通STAR法则。你需要为${config.name}岗位优化简历。

优化原则：
1. 使用STAR法则（Situation情境、Task任务、Action行动、Result结果）重构每段经历
2. 语气专业自信，避免谦虚和模糊表达
3. 量化成果，使用具体数据，可参考这些占位符格式：${config.dataPlaceholders.join('、')}
4. 突出${config.expertStrategy}

直接输出优化后的完整简历文本，不要包含任何JSON格式或额外说明。所有回复必须使用中文。`;
      userPrompt = `请优化以下简历：\n\n${content}`;
    } else if (type === 'polish_sentence') {
      let styleInstruction = '';
      
      if (style === 'standard') {
        styleInstruction = '语言简练专业，突出核心能力，避免冗余表达';
      } else if (style === 'data') {
        const forcedPlaceholders = config.dataPlaceholders.join('、');
        styleInstruction = `【数据驱动模式】你是一个数据狂魔。用户给你的这句话缺乏说服力。请重写它，并**强制**插入量化数据占位符。
        
必须使用的占位符格式（从中选择1-2个最合适的）：
${forcedPlaceholders}

占位符必须用方括号 [] 包裹，这是强制要求！重写后的句子必须包含至少一个数据占位符。`;
      } else if (style === 'expert') {
        styleInstruction = `【${config.expertModeName}】
${config.expertStrategy}
强调技术深度和行业影响力，体现战略思维和专家视角。使用更高级的专业术语和商业语言。`;
      }

      systemPrompt = `你是一位专业的简历文案专家，针对${config.name}岗位优化简历语句。

${styleInstruction}

直接输出优化后的句子，不要包含任何JSON格式、引号或额外说明。所有回复必须使用中文。`;
      userPrompt = `请优化这句话：${content}`;
    } else {
      throw new Error('不支持的流式请求类型');
    }

    // 使用硅基流动 API，启用流式响应
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI 额度已用完，请稍后再试' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI 服务暂时不可用');
    }

    // 直接返回流式响应
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Resume AI stream error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : '未知错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
