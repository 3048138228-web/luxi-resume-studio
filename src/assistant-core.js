(function attachAssistant(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.JobAssistant = factory();
  }
})(typeof self !== "undefined" ? self : this, function buildAssistant() {
  "use strict";

  const CATEGORY_KEYWORDS = {
    数据分析: ["数据分析", "SQL", "Python", "Excel", "Tableau", "Power BI", "BI", "统计", "建模", "指标", "A/B", "AB测试", "看板"],
    产品运营: ["用户运营", "内容运营", "活动策划", "增长", "留存", "转化", "社群", "CRM", "策略", "复盘", "运营"],
    研究咨询: ["行业研究", "市场研究", "竞品", "政策研究", "调研", "访谈", "报告", "咨询", "商业分析"],
    内容传播: ["文案", "公众号", "新媒体", "内容", "写作", "编辑", "传播", "短视频", "品牌"],
    项目协同: ["项目管理", "推进", "协调", "跨部门", "落地", "执行", "沟通", "资源整合"],
    AI自动化: ["AI", "AIGC", "大模型", "ChatGPT", "提示词", "智能体", "自动化", "机器学习"],
    财务商业: ["财务", "金融", "投研", "估值", "商业化", "收入", "成本", "预算", "风控"]
  };

  const FIELD_RULES = [
    { type: "jobRole", labels: ["应聘职位", "申请职位", "应聘岗位", "申请岗位", "岗位名称", "职位"] },
    { type: "name", labels: ["姓名", "真实姓名", "name"] },
    { type: "gender", labels: ["性别"] },
    { type: "birthDate", labels: ["出生日期", "出生年月", "生日"] },
    { type: "age", labels: ["年龄"] },
    { type: "countryRegion", labels: ["国家 / 地区", "国家/地区", "国家", "地区", "国籍"] },
    { type: "nativePlace", labels: ["籍贯", "户籍", "生源地"] },
    { type: "phone", labels: ["手机号", "手机", "电话", "联系方式", "联系电话", "phone", "mobile"] },
    { type: "email", labels: ["邮箱", "电子邮件", "email", "mail"] },
    { type: "expectedLocation", labels: ["期望工作地点", "意向工作地点", "期望城市", "意向城市"] },
    { type: "highestSchool", labels: ["最高学历毕业院校", "最高学历院校", "最高学历学校"] },
    { type: "firstSchool", labels: ["第一学历毕业院校", "第一学历院校", "第一学历学校"] },
    { type: "school", labels: ["学校", "毕业院校", "院校", "大学"] },
    { type: "ranking", labels: ["专业成绩排名", "成绩排名", "排名"] },
    { type: "major", labels: ["专业", "所学专业", "专业名称"] },
    { type: "education", labels: ["学历", "最高学历", "学位"] },
    { type: "graduation", labels: ["毕业时间", "毕业年份", "入学", "毕业"] },
    { type: "dateStart", labels: ["开始日期", "起始日期", "开始时间"] },
    { type: "dateEnd", labels: ["结束日期", "终止日期", "结束时间"] },
    { type: "availability", labels: ["到岗", "入职时间", "可实习", "每周", "实习时长"] },
    { type: "skills", labels: ["技能", "专业技能", "工具", "语言能力", "证书"] },
    { type: "internship", labels: ["实习", "工作经历", "实践经历", "相关经历", "任职经历"] },
    { type: "project", labels: ["项目", "项目经历", "项目经验", "作品", "代表作品"] },
    { type: "awards", labels: ["获奖", "奖项", "荣誉", "证书"] },
    { type: "selfIntro", labels: ["自我评价", "个人评价", "个人优势", "个人简介", "优势总结"] },
    { type: "whyRole", labels: ["求职动机", "申请理由", "为什么申请", "为什么投递", "岗位理解"] },
    { type: "whyCompany", labels: ["为什么选择", "公司理解", "对公司的了解", "加入我们"] },
    { type: "salary", labels: ["期望薪资", "薪资", "待遇"] },
    { type: "transfer", labels: ["调剂", "服从分配", "是否接受"] },
    { type: "location", labels: ["地点", "城市", "工作地"] },
    { type: "openQuestion", labels: ["最近看了什么", "书", "人生的意义", "人生意义", "价值观", "兴趣爱好", "如何看待", "你怎么看"] }
  ];

  const DEFAULT_FIELDS = ["自我评价", "相关实习经历", "项目经历", "求职动机", "是否接受调剂"];

  const FACT_ALIASES = {
    highestSchool: ["最高学历毕业院校", "最高学历院校", "最高学历学校"],
    firstSchool: ["第一学历毕业院校", "第一学历院校", "第一学历学校"],
    highestEducation: ["最高学历", "最高学位"],
    expectedLocation: ["期望工作地点", "意向工作地点", "期望城市", "意向城市"],
    birthDate: ["出生日期", "出生年月", "生日"],
    countryRegion: ["国家 / 地区", "国家/地区", "国家地区", "国籍", "国家", "地区"],
    nativePlace: ["籍贯", "户籍", "生源地"],
    educationStart: ["教育开始日期", "学历开始日期", "本科开始日期", "入学时间"],
    educationEnd: ["教育结束日期", "学历结束日期", "本科结束日期", "毕业时间"],
    firstEducationStart: ["第一学历开始日期", "第一学历入学时间"],
    firstEducationEnd: ["第一学历结束日期", "第一学历毕业时间"],
    ranking: ["专业成绩排名", "成绩排名", "排名"],
    book: ["最近看了什么有趣的书", "最近看的书", "推荐书", "书籍推荐"],
    lifeMeaning: ["如何看待人生的意义", "人生的意义", "人生意义"],
    name: ["姓名", "真实姓名"],
    gender: ["性别"],
    age: ["年龄"],
    phone: ["手机号", "手机", "电话", "联系方式", "联系电话"],
    email: ["邮箱", "电子邮件"],
    school: ["学校", "毕业院校", "院校"],
    major: ["专业", "所学专业", "专业名称"],
    education: ["学历", "学位"],
    availability: ["到岗时间", "入职时间", "每周可实习天数", "实习时长"],
    salary: ["期望薪资", "薪资"],
    transfer: ["是否接受调剂", "是否服从分配", "调剂"]
  };

  function normalizeText(text) {
    return String(text || "")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[ \u00a0]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function splitLines(text) {
    return normalizeText(text)
      .split(/\n|；|;/)
      .map((line) => line.replace(/^[\s\-*•·●\d.、)）]+/, "").trim())
      .filter(Boolean);
  }

  function cleanFactValue(value) {
    return String(value || "")
      .replace(/\*\*/g, "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
  }

  function normalizeFactKey(label) {
    return String(label || "")
      .replace(/\*\*/g, "")
      .replace(/[：:|]/g, "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();
  }

  function mapFactKey(label) {
    const normalized = normalizeFactKey(label);
    for (const [key, aliases] of Object.entries(FACT_ALIASES)) {
      const normalizedAliases = aliases.map(normalizeFactKey).sort((a, b) => b.length - a.length);
      if (normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        return key;
      }
    }
    return "";
  }

  function parseKnowledgeBase(text) {
    const facts = {};
    normalizeText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const table = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/);
        const pair = line.match(/^(?:[-*+]\s*)?(?:\*\*)?([^:：]{1,40})(?:\*\*)?\s*[:：]\s*(.+)$/);
        const label = table ? table[1] : pair ? pair[1] : "";
        const value = table ? table[2] : pair ? pair[2] : "";
        const key = mapFactKey(label);
        const cleaned = cleanFactValue(value);
        if (key && cleaned && !/^[-—]+$/.test(cleaned) && !facts[key]) {
          facts[key] = cleaned;
        }
      });
    return facts;
  }

  function getFact(candidate, keys) {
    for (const key of keys) {
      if (candidate.facts && candidate.facts[key]) return candidate.facts[key];
    }
    return "";
  }

  function hasTerm(text, term) {
    if (!term) return false;
    if (/^[A-Za-z0-9+.#/ -]+$/.test(term)) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
    }
    return text.includes(term);
  }

  function findKeywords(text) {
    const found = [];
    Object.entries(CATEGORY_KEYWORDS).forEach(([category, terms]) => {
      terms.forEach((term) => {
        if (hasTerm(text, term)) found.push({ category, term });
      });
    });
    return unique(found.map((item) => `${item.category}:${item.term}`)).map((value) => {
      const [category, term] = value.split(":");
      return { category, term };
    });
  }

  function topCategories(keywordItems) {
    const counts = new Map();
    keywordItems.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
      .slice(0, 3);
  }

  function extractByPattern(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1].trim().replace(/[，,。；;].*$/, "");
    }
    return "";
  }

  function guessRole(jdText, explicitRole) {
    if (normalizeText(explicitRole)) return normalizeText(explicitRole);
    const role = extractByPattern(jdText, [
      /(?:岗位名称|职位名称|招聘岗位|申请岗位)[:：]\s*([^\n]+)/i,
      /(?:招聘|诚聘)\s*([^\n]{2,30}(?:实习生|专员|经理|管培生|分析师|运营|助理))/i
    ]);
    if (role) return role;
    return "目标岗位";
  }

  function guessCompany(jdText, explicitCompany) {
    if (normalizeText(explicitCompany)) return normalizeText(explicitCompany);
    const company = extractByPattern(jdText, [
      /(?:公司名称|公司|雇主|单位)[:：]\s*([^\n]+)/i,
      /([^\n]{2,30}(?:公司|集团|科技|咨询|银行|证券|事务所|研究院))/
    ]);
    if (company) return company;
    return "目标公司";
  }

  function classifySeniority(text) {
    if (/实习|intern/i.test(text)) return "实习/早期岗位";
    if (/应届|校招|毕业生|管培/i.test(text)) return "应届/校招岗位";
    const yearMatch = text.match(/(\d+)\s*(?:年|\+)\s*(?:以上)?(?:经验|工作经验)/);
    if (yearMatch) return `${yearMatch[1]} 年以上经验岗位`;
    return "经验要求未明确";
  }

  function pickRelevantLines(text, keywordItems, maxCount) {
    const lines = splitLines(text);
    const terms = keywordItems.map((item) => item.term);
    const scored = lines.map((line, index) => {
      const score = terms.reduce((total, term) => total + (hasTerm(line, term) ? 2 : 0), 0) +
        (/[负责|参与|主导|协助|完成|撰写|分析|运营|策划|推进]/.test(line) ? 1 : 0);
      return { line, index, score };
    });
    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, maxCount)
      .map((item) => item.line);
  }

  function isSectionHeader(line) {
    const label = String(line || "").split(/[:：]/, 1)[0].trim();
    return /^(?:岗位职责|工作职责|职位描述|职责描述|工作内容|任职要求|岗位要求|职位要求|任职资格|我们希望|加分项|加分条件|优先条件|bonus|福利待遇|薪酬福利|岗位福利)$/i.test(label);
  }

  function extractSectionLines(text, headers) {
    const lines = splitLines(text);
    const result = [];
    let active = false;
    lines.forEach((line) => {
      const sectionLabel = line.split(/[:：]/, 1)[0].trim();
      const matchesTargetSection = isSectionHeader(line) && headers.some((header) => sectionLabel.toLowerCase().includes(header.toLowerCase()));
      if (matchesTargetSection) {
        active = true;
        const cleaned = line.replace(/^.*?[:：]/, "").trim();
        if (cleaned && cleaned !== line) result.push(cleaned);
        return;
      }
      if (active && isSectionHeader(line)) {
        active = false;
      }
      if (active) result.push(line);
    });
    return result.slice(0, 6);
  }

  function inferEducationFromEducationLines(text) {
    const lines = splitLines(text).filter((line) => /(大学|学院|学校|本科|硕士|博士|研究生|大专)/.test(line));
    const rank = ["博士", "硕士", "研究生", "本科", "学士", "大专"];
    for (const degree of rank) {
      if (lines.some((line) => line.includes(degree) && /(大学|学院|学校|学历|学位)/.test(line))) {
        return degree === "研究生" ? "硕士/研究生" : degree;
      }
    }
    return "";
  }

  function inferMajor(text) {
    const explicit = extractByPattern(text, [/(?:专业)[:：]\s*([^\n]+)/]);
    if (explicit) return explicit;
    const educationLine = splitLines(text).find((line) => /(大学|学院).*(·|｜|\|).*(20\d{2}|专业|双学位)/.test(line));
    if (!educationLine) return "";
    const afterDot = educationLine.split(/[·]/).slice(1).join("·").trim();
    if (!afterDot) return "";
    return afterDot.replace(/\s*20\d{2}[./年-].*$/, "").trim();
  }

  function extractJobSignals(jdText, companyInput, roleInput) {
    const normalized = normalizeText(jdText);
    const keywords = findKeywords(normalized);
    const responsibilities = extractSectionLines(normalized, ["工作职责", "岗位职责", "职位描述", "工作内容", "职责描述"]);
    const requirements = extractSectionLines(normalized, ["任职要求", "岗位要求", "职位要求", "任职资格", "我们希望"]);
    const bonus = extractSectionLines(normalized, ["加分", "优先", "bonus"]);
    const fallbackLines = splitLines(normalized).slice(0, 6);

    return {
      company: guessCompany(normalized, companyInput),
      role: guessRole(normalized, roleInput),
      seniority: classifySeniority(normalized),
      categories: topCategories(keywords),
      keywords,
      responsibilities: responsibilities.length ? responsibilities : fallbackLines.slice(0, 3),
      requirements: requirements.length ? requirements : fallbackLines.slice(3, 6),
      bonus,
      raw: normalized
    };
  }

  function extractCandidateSignals(materialText) {
    const normalized = normalizeText(materialText);
    const facts = parseKnowledgeBase(normalized);
    const keywords = findKeywords(normalized);
    const phone = facts.phone || (normalized.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/) || [""])[0];
    const email = facts.email || (normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const name = facts.name || extractByPattern(normalized, [/姓名[:：]\s*([^\n\s，,]+)/, /^([\u4e00-\u9fa5]{2,4})\s*(?:\n|$)/]);
    const school = facts.highestSchool || facts.school || "";
    const major = facts.major || inferMajor(normalized);
    const education = facts.highestEducation || facts.education || inferEducationFromEducationLines(normalized);
    const graduation = facts.educationEnd || extractByPattern(normalized, [/(20\d{2}[年./-]\d{0,2}|20\d{2}\s*届)/]);
    const skillLines = splitLines(normalized).filter((line) => /技能|工具|语言|证书|熟练|掌握|Excel|SQL|Python|英语|CET|雅思|托福/i.test(line));
    const projectLines = splitLines(normalized).filter((line) => /项目|课题|研究|作品|系统|模型|报告|调研/.test(line));
    const experienceLines = splitLines(normalized).filter((line) => /实习|公司|负责|参与|协助|运营|策划|撰写|分析|推进|组织/.test(line));
    const awardLines = splitLines(normalized).filter((line) => /奖|荣誉|证书|竞赛|优秀|奖学金/.test(line));

    return {
      name,
      phone,
      email,
      school,
      major,
      education,
      graduation,
      facts,
      keywords,
      categories: topCategories(keywords),
      skillLines: skillLines.slice(0, 6),
      projectLines: projectLines.slice(0, 6),
      experienceLines: experienceLines.slice(0, 8),
      awardLines: awardLines.slice(0, 5),
      raw: normalized
    };
  }

  function compareSignals(job, candidate) {
    const jobTerms = unique(job.keywords.map((item) => item.term));
    const candidateTerms = unique(candidate.keywords.map((item) => item.term));
    const matchedKeywords = jobTerms.filter((term) => candidateTerms.some((candidateTerm) => candidateTerm.toLowerCase() === term.toLowerCase()));
    const missingKeywords = jobTerms.filter((term) => !matchedKeywords.some((matched) => matched.toLowerCase() === term.toLowerCase()));
    const evidenceLines = pickRelevantLines(candidate.raw, job.keywords, 6);
    const score = jobTerms.length ? Math.round((matchedKeywords.length / jobTerms.length) * 100) : 0;
    return {
      matchedKeywords,
      missingKeywords,
      evidenceLines,
      score
    };
  }

  function joinOrConfirm(items, fallback) {
    return items && items.length ? items.join("、") : `待确认：${fallback}`;
  }

  function stripTrailingPunctuation(text) {
    return String(text || "").replace(/[。.,，；;、\s]+$/, "");
  }

  function evidencePhrase(line) {
    const cleaned = stripTrailingPunctuation(line);
    const parts = cleaned.split(/[:：]/);
    if (parts.length >= 2 && /实习|项目|经历|工作|实践/.test(parts[0])) {
      return `在${parts[0]}中${parts.slice(1).join("：")}`;
    }
    return cleaned;
  }

  function isSkillOnlyLine(line) {
    return /^技能|^工具|^语言|^证书/i.test(line.trim());
  }

  function parseSkillTokens(skillLines) {
    return unique(
      skillLines
        .map((line) => line.replace(/^.*?(技能|工具|语言|证书)[:：]/, ""))
        .join("、")
        .split(/[、,，；;。]+/)
        .map((item) => stripTrailingPunctuation(item.trim()))
        .filter((item) => item.length >= 2)
    ).slice(0, 10);
  }

  function buildProfile(job) {
    const categoryText = job.categories.length ? job.categories.join("、") : "岗位方向未明确";
    const keywordText = job.keywords.length ? unique(job.keywords.map((item) => item.term)).slice(0, 10).join("、") : "JD 中未识别到明显关键词";
    const responsibilityText = job.responsibilities.length ? job.responsibilities.slice(0, 4) : ["待确认：JD 职责描述不足"];
    const requirementText = job.requirements.length ? job.requirements.slice(0, 4) : ["待确认：JD 任职要求不足"];
    const bullets = [
      `岗位类型：${categoryText}`,
      `经验层级：${job.seniority}`,
      `核心关键词：${keywordText}`,
      `主要职责：${responsibilityText.join("；")}`,
      `硬性要求：${requirementText.join("；")}`
    ];
    if (job.bonus.length) bullets.push(`加分项：${job.bonus.slice(0, 4).join("；")}`);
    return {
      title: `${job.company}｜${job.role}`,
      bullets
    };
  }

  function buildMatchAnalysis(job, candidate, comparison) {
    const prioritizedEvidence = comparison.evidenceLines
      .filter((line) => !isSkillOnlyLine(line))
      .concat(comparison.evidenceLines.filter(isSkillOnlyLine));
    const strongMatches = prioritizedEvidence.length
      ? prioritizedEvidence.slice(0, 4)
      : ["待确认：个人材料中暂未识别到可直接对应 JD 的经历"];
    const weakAreas = comparison.missingKeywords.length
      ? comparison.missingKeywords.slice(0, 6)
      : ["未发现明显关键词缺口，但仍需人工确认经历真实性和岗位偏好"];
    const transferable = candidate.experienceLines
      .filter((line) => !comparison.evidenceLines.includes(line))
      .slice(0, 3);
    const avoidClaims = comparison.missingKeywords.slice(0, 4).map((term) => `不要直接写“精通${term}”，除非简历中有项目、成果或证书支撑`);

    return {
      score: comparison.score,
      bullets: [
        `关键词重合：${joinOrConfirm(comparison.matchedKeywords.slice(0, 8), "未从简历材料中识别到与 JD 完全相同的关键词")}`,
        `强匹配证据：${strongMatches.join("；")}`,
        `可迁移匹配：${transferable.length ? transferable.join("；") : "待确认：暂无更多可迁移经历，建议补充项目、作品或实践细节"}`,
        `相对薄弱：${weakAreas.join("、")}`,
        `不建议强写：${avoidClaims.length ? avoidClaims.join("；") : "暂无明显需要回避的关键词"}`
      ]
    };
  }

  function buildTailoredResume(job, candidate, comparison) {
    const matched = comparison.matchedKeywords.slice(0, 5);
    const experienceEvidence = comparison.evidenceLines.filter((line) => !isSkillOnlyLine(line));
    const evidence = (experienceEvidence.length ? experienceEvidence : comparison.evidenceLines).slice(0, 3);
    const categories = unique(job.categories.concat(candidate.categories)).slice(0, 3);
    const summary = evidence.length
      ? `具备${joinOrConfirm(matched, "请补充与岗位相关的技能或经历")}相关经验，曾${evidencePhrase(evidence[0])}，适合投递${job.role}。`
      : `待确认：个人材料中缺少可直接支撑${job.role}的经历，建议先补充项目、实习或作品细节。`;

    const bullets = evidence.length
      ? evidence.map((line) => `围绕“${job.role}”改写：${stripTrailingPunctuation(line)}，突出${joinOrConfirm(matched.slice(0, 3), "岗位关键词")}。`)
      : ["待确认：请补充 2-3 段最相关经历后再生成 bullet。"];

    const skills = parseSkillTokens(candidate.skillLines);

    return {
      summary,
      bullets,
      skillOrder: skills.length
      ? `技能排序建议：先放${joinOrConfirm(matched, "JD 明确要求的技能")}，再放${skills.join("、")}。`
      : "待确认：个人材料中未识别到技能清单，请补充工具、语言、证书或专业技能。", 
      positioning: categories.length ? `模板方向：${categories.join(" / ")} 型简历。` : "模板方向：需根据 JD 和简历补充后确定。"
    };
  }

  function inferFieldType(label) {
    const normalized = normalizeText(label).toLowerCase();
    const rule = FIELD_RULES.find((item) => item.labels.some((word) => normalized.includes(word.toLowerCase())));
    return rule ? rule.type : "general";
  }

  function parseFormFields(formText) {
    const lines = splitLines(formText);
    const sourceLines = lines.length ? lines : DEFAULT_FIELDS;
    return sourceLines
      .map((line) => line.replace(/[*必填（）()]/g, "").trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((label) => ({
        label,
        type: inferFieldType(label)
      }));
  }

  function pickCompact(lines, maxCount) {
    return (lines || []).slice(0, maxCount).map((line) => line.replace(/[。.]$/, ""));
  }

  function buildSelfIntro(job, candidate, comparison) {
    if (!comparison.evidenceLines.length) {
      return `待确认：请补充与${job.role}相关的实习、项目或作品后再填写。`;
    }
    const keywords = comparison.matchedKeywords.slice(0, 4).join("、") || job.categories.join("、") || "岗位相关";
    const primaryEvidence = comparison.evidenceLines.find((line) => !isSkillOnlyLine(line)) || comparison.evidenceLines[0];
    return `我具备${keywords}相关经验，曾${evidencePhrase(primaryEvidence)}。希望在${job.role}岗位中继续承担分析、执行与协同工作。`;
  }

  function buildWhyRole(job, comparison) {
    const jdFocus = job.responsibilities[0] || job.requirements[0] || "";
    if (!jdFocus && !comparison.matchedKeywords.length) {
      return "待确认：JD 信息不足，请补充岗位职责后再填写求职动机。";
    }
    const matched = comparison.matchedKeywords.slice(0, 4).join("、") || "相关经历";
    return `我申请该岗位，是因为岗位要求中的“${jdFocus || job.role}”与我过往${matched}经验匹配，希望把已有经验继续用于真实业务场景。`;
  }

  function buildWhyCompany(job, comparison) {
    if (job.company === "目标公司") {
      return "待确认：请补充公司名称或官网信息后再填写公司动机。";
    }
    const focus = comparison.matchedKeywords.slice(0, 3).join("、") || job.role;
    return `我关注${job.company}的业务场景，也希望在${job.role}岗位中结合过往${focus}经验，参与具体问题的分析、执行和复盘。`;
  }

  function openQuestionAnswer(label, facts) {
    if (/书/.test(label) && facts.book) return facts.book;
    if (/人生|意义|价值观/.test(label) && facts.lifeMeaning) return facts.lifeMeaning;
    return "待确认：这是开放题，需要本人观点或素材；资料库未提供时不自动套用岗位经历。";
  }

  function answerForField(field, job, candidate, comparison) {
    const preferredExperience = candidate.experienceLines.length ? candidate.experienceLines : comparison.evidenceLines.filter((line) => !isSkillOnlyLine(line));
    const experienceText = pickCompact(preferredExperience, 3).join("；");
    const projectText = pickCompact(candidate.projectLines, 3).join("；");
    const skillText = candidate.skillLines.length ? candidate.skillLines.slice(0, 4).join("；") : "";
    const facts = candidate.facts || {};

    const answers = {
      jobRole: job.role && job.role !== "目标岗位" ? job.role : "待确认：请填写本次申请的岗位名称。",
      name: candidate.name || "待确认：请填写与证件一致的姓名。",
      gender: facts.gender || "待确认：请按证件或系统选项填写。",
      birthDate: facts.birthDate || "待确认：请按证件填写出生日期。",
      age: facts.age || "待确认：请按系统规则填写或由出生日期自动计算。",
      countryRegion: facts.countryRegion || "待确认：请按证件或系统选项填写国家 / 地区。",
      nativePlace: facts.nativePlace || "待确认：请按户籍/籍贯真实信息填写。",
      phone: candidate.phone || "待确认：个人材料中未识别到手机号。",
      email: candidate.email || "待确认：个人材料中未识别到邮箱。",
      expectedLocation: facts.expectedLocation || "待确认：请按真实可接受城市填写。",
      highestSchool: facts.highestSchool || "待确认：资料库中未提供最高学历毕业院校。",
      firstSchool: facts.firstSchool || "待确认：资料库中未提供第一学历毕业院校。",
      school: candidate.school || "待确认：资料库中未提供毕业院校。",
      major: candidate.major || "待确认：资料库中未识别到专业。",
      ranking: facts.ranking || "待确认：资料库中未提供专业成绩排名。",
      education: candidate.education || "待确认：请按真实最高学历选择。",
      graduation: candidate.graduation || "待确认：个人材料中未识别到毕业时间。",
      dateStart: facts.educationStart || "待确认：请根据当前模块（教育/实习/项目）填写对应开始日期。",
      dateEnd: facts.educationEnd || "待确认：请根据当前模块（教育/实习/项目）填写对应结束日期。",
      skills: skillText || `待确认：请补充与${job.role}相关的技能、工具、语言或证书。`,
      internship: experienceText || `待确认：个人材料中未识别到与${job.role}相关的实习/工作经历。`,
      project: projectText || `待确认：个人材料中未识别到明确项目经历。`,
      awards: candidate.awardLines.length ? candidate.awardLines.slice(0, 3).join("；") : "待确认：如无相关奖项，可按系统规则留空或填“无”。",
      selfIntro: buildSelfIntro(job, candidate, comparison),
      whyRole: buildWhyRole(job, comparison),
      whyCompany: buildWhyCompany(job, comparison),
      salary: facts.salary || "待确认：请按你的真实期望薪资或系统范围选择，不建议为提高匹配度虚填。",
      availability: facts.availability || "待确认：请填写真实可到岗时间、每周可实习天数和可持续月数。",
      transfer: facts.transfer || "待确认：按真实意愿选择是否接受调剂，不建议为了通过筛选违背实际意愿。",
      location: facts.expectedLocation || "待确认：请按真实可接受城市填写。",
      openQuestion: openQuestionAnswer(field.label, facts)
    };

    if (answers[field.type]) {
      return answers[field.type];
    }

    if (/是否|能否|可否/.test(field.label)) {
      return "建议选择：按真实情况选择；理由：该字段通常涉及到岗、调剂、实习周期或资格条件，不能替你编造。";
    }
    if (/为什么|原因|理由|动机/.test(field.label)) {
      return buildWhyRole(job, comparison);
    }
    return "待确认：资料库中没有找到该字段的明确内容，请补充到个人资料库后再生成。";
  }

  function buildFormAnswers(fields, job, candidate, comparison) {
    return fields.map((field) => {
      const answer = answerForField(field, job, candidate, comparison);
      const needsConfirmation = /待确认|按真实|真实情况|真实意愿/.test(answer);
      const generatedTypes = ["selfIntro", "whyRole", "whyCompany", "internship", "project", "skills"];
      const reason = answer.startsWith("待确认")
        ? "现有材料没有足够证据，本工具不会代填事实。"
        : generatedTypes.includes(field.type)
          ? "依据 JD 关键词与个人材料中的可核实内容整理。"
          : "依据个人材料中的明确事实或本人偏好字段整理。";
      return {
        label: field.label,
        type: field.type,
        answer,
        reason,
        confirmation: needsConfirmation ? "提交前请补充或核对真实信息。" : "提交前请与原始材料逐字核对。",
        status: needsConfirmation ? "pending" : "ready"
      };
    });
  }

  function buildRisks(job, candidate, comparison, formAnswers) {
    const risks = [];
    if (!candidate.raw) risks.push("待确认：未提供个人材料，不能生成可信的简历改写。");
    if (!job.raw) risks.push("待确认：未提供 JD，岗位画像只能按默认字段生成。");
    if (comparison.missingKeywords.length) {
      risks.push(`JD 中的这些关键词缺少简历证据：${comparison.missingKeywords.slice(0, 8).join("、")}。`);
    }
    if (!comparison.evidenceLines.length) {
      risks.push("个人材料中缺少可直接对应岗位职责的经历，建议先补充 2-3 段相关实习或项目。");
    }
    const confirmFields = formAnswers.filter((item) => item.answer.includes("待确认") || item.answer.includes("需确认")).map((item) => item.label);
    if (confirmFields.length) {
      risks.push(`以下表单字段需要人工确认：${confirmFields.slice(0, 10).join("、")}。`);
    }
    risks.push("不要自动提交申请；复制粘贴前逐项检查姓名、时间、薪资、调剂、到岗时间等事实字段。");
    return unique(risks);
  }

  function analyzeApplication(inputs) {
    const jd = extractJobSignals(inputs.jdText || "", inputs.company || "", inputs.role || "");
    const candidate = extractCandidateSignals(inputs.resumeText || "");
    const comparison = compareSignals(jd, candidate);
    const fields = parseFormFields(inputs.formText || "");
    const formAnswers = buildFormAnswers(fields, jd, candidate, comparison);
    const result = {
      profile: buildProfile(jd),
      match: buildMatchAnalysis(jd, candidate, comparison),
      tailoredResume: buildTailoredResume(jd, candidate, comparison),
      formAnswers,
      risks: buildRisks(jd, candidate, comparison, formAnswers),
      meta: {
        company: jd.company,
        role: jd.role,
        matchedCount: comparison.matchedKeywords.length,
        missingCount: comparison.missingKeywords.length,
        fieldCount: formAnswers.length
      }
    };
    result.markdown = renderMarkdownReport(result);
    return result;
  }

  function renderMarkdownReport(result) {
    const lines = [];
    lines.push(`# ${result.meta.company}｜${result.meta.role} 填写方案`);
    lines.push("");
    lines.push("## 1. 岗位画像");
    result.profile.bullets.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    lines.push("## 2. 匹配分析");
    result.match.bullets.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    lines.push("## 3. 定制简历版本");
    lines.push(`- 摘要：${result.tailoredResume.summary}`);
    result.tailoredResume.bullets.forEach((item) => lines.push(`- ${item}`));
    lines.push(`- ${result.tailoredResume.skillOrder}`);
    lines.push(`- ${result.tailoredResume.positioning}`);
    lines.push("");
    lines.push("## 4. 表单填写稿");
    result.formAnswers.forEach((item) => {
      lines.push(`- ${item.label}`);
      lines.push(`  - 建议填写：${item.answer}`);
      lines.push(`  - 填写理由：${item.reason}`);
      lines.push(`  - 待确认：${item.confirmation}`);
    });
    lines.push("");
    lines.push("## 5. 风险提示");
    result.risks.forEach((item) => lines.push(`- ${item}`));
    return lines.join("\n");
  }

  return {
    analyzeApplication,
    parseFormFields,
    extractJobSignals,
    extractCandidateSignals,
    renderMarkdownReport
  };
});
