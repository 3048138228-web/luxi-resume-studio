(function attachResumeLibrary(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./assistant-core"));
  } else {
    root.ResumeLibrary = factory(root.JobAssistant);
  }
})(typeof self !== "undefined" ? self : this, function buildResumeLibrary(assistant) {
  "use strict";

  const PROFILE_FIELDS = [
    "name", "phone", "email", "city", "headline", "education", "school",
    "major", "graduation", "skills", "languages", "certificates"
  ];

  const EXPERIENCE_FIELDS = [
    "id", "type", "title", "organization", "startDate", "endDate",
    "situation", "task", "action", "result", "skills", "source", "imported"
  ];

  const TYPE_LABELS = {
    internship: "实习经历",
    work: "工作经历",
    project: "项目经历",
    research: "科研经历",
    campus: "校园经历",
    volunteer: "志愿服务",
    other: "其他经历"
  };

  const PROFILE_LABELS = {
    name: "姓名",
    phone: "手机号",
    email: "邮箱",
    city: "所在城市",
    headline: "职业定位",
    education: "最高学历",
    school: "院校",
    major: "专业",
    graduation: "毕业时间",
    skills: "技能",
    languages: "语言能力",
    certificates: "证书与资质"
  };

  function clean(value) {
    return String(value || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  }

  function unique(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function emptyProfile() {
    return PROFILE_FIELDS.reduce((profile, field) => {
      profile[field] = "";
      return profile;
    }, {});
  }

  function createEmptyLibrary() {
    return {
      version: 1,
      profile: emptyProfile(),
      experiences: [],
      sources: [],
      updatedAt: ""
    };
  }

  function normalizeExperience(value) {
    const source = value || {};
    const normalized = EXPERIENCE_FIELDS.reduce((item, field) => {
      if (field === "imported") item[field] = Boolean(source[field]);
      else item[field] = clean(source[field]);
      return item;
    }, {});
    normalized.id = normalized.id || makeId("exp");
    normalized.type = TYPE_LABELS[normalized.type] ? normalized.type : "other";
    return normalized;
  }

  function normalizeLibrary(value) {
    const source = value && typeof value === "object" ? value : {};
    const library = createEmptyLibrary();
    PROFILE_FIELDS.forEach((field) => {
      library.profile[field] = clean(source.profile && source.profile[field]);
    });
    library.experiences = Array.isArray(source.experiences)
      ? source.experiences.map(normalizeExperience)
      : [];
    library.sources = Array.isArray(source.sources)
      ? source.sources.map((item) => ({
          id: clean(item.id) || makeId("source"),
          name: clean(item.name) || "未命名材料",
          type: clean(item.type) || "text",
          text: clean(item.text),
          importedAt: clean(item.importedAt)
        }))
      : [];
    library.updatedAt = clean(source.updatedAt);
    return library;
  }

  function splitSkillText(value) {
    return unique(clean(value).split(/[、,，；;\n/]+/).map(clean)).slice(0, 24);
  }

  function inferExperienceType(line) {
    if (/志愿|公益|支教|社区/.test(line)) return "volunteer";
    if (/科研|研究|论文|课题/.test(line)) return "research";
    if (/实习/.test(line)) return "internship";
    if (/项目|作品|系统|产品/.test(line)) return "project";
    if (/校园|学生会|社团|班级/.test(line)) return "campus";
    if (/工作|任职|公司/.test(line)) return "work";
    return "other";
  }

  function lineToExperience(line, sourceName) {
    const value = clean(line).replace(/^[-*•·\d.、)）\s]+/, "");
    const parts = value.split(/[:：]/);
    const hasShortTitle = parts.length > 1 && clean(parts[0]).length <= 32;
    const type = inferExperienceType(value);
    return normalizeExperience({
      type,
      title: hasShortTitle ? clean(parts.shift()) : TYPE_LABELS[type],
      action: hasShortTitle ? clean(parts.join("：")) : value,
      source: sourceName,
      imported: true
    });
  }

  function analyzeImportedResume(text, sourceName) {
    const normalizedText = clean(text);
    const candidate = assistant.extractCandidateSignals(normalizedText);
    const experienceLines = unique(candidate.experienceLines.concat(candidate.projectLines))
      .filter((line) => !/^(?:技能|工具|语言|证书)[:：]/.test(line))
      .slice(0, 16);
    const skillText = candidate.skillLines
      .map((line) => line.replace(/^.*?(?:技能|工具|语言|证书)[:：]/, ""))
      .join("、");
    return {
      sourceName: clean(sourceName) || "导入简历",
      text: normalizedText,
      profilePatch: {
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
        education: candidate.education,
        school: candidate.school,
        major: candidate.major,
        graduation: candidate.graduation,
        skills: splitSkillText(skillText).join("、")
      },
      experiences: experienceLines.map((line) => lineToExperience(line, sourceName)),
      stats: {
        factCount: Object.values(candidate.facts || {}).filter(Boolean).length,
        experienceCount: experienceLines.length,
        skillCount: splitSkillText(skillText).length
      }
    };
  }

  function mergeImport(libraryValue, analysis, sourceType) {
    const library = normalizeLibrary(libraryValue);
    PROFILE_FIELDS.forEach((field) => {
      if (!library.profile[field] && analysis.profilePatch[field]) {
        library.profile[field] = clean(analysis.profilePatch[field]);
      }
    });
    const signatures = new Set(library.experiences.map((item) => `${item.title}|${item.action}`));
    analysis.experiences.forEach((item) => {
      const normalized = normalizeExperience(item);
      const signature = `${normalized.title}|${normalized.action}`;
      if (!signatures.has(signature)) {
        library.experiences.push(normalized);
        signatures.add(signature);
      }
    });
    library.sources.push({
      id: makeId("source"),
      name: analysis.sourceName,
      type: clean(sourceType) || "text",
      text: analysis.text,
      importedAt: new Date().toISOString()
    });
    library.updatedAt = new Date().toISOString();
    return library;
  }

  function upsertExperience(libraryValue, experience) {
    const library = normalizeLibrary(libraryValue);
    const item = normalizeExperience(experience);
    const index = library.experiences.findIndex((entry) => entry.id === item.id);
    if (index >= 0) library.experiences[index] = item;
    else library.experiences.push(item);
    library.updatedAt = new Date().toISOString();
    return library;
  }

  function removeExperience(libraryValue, id) {
    const library = normalizeLibrary(libraryValue);
    library.experiences = library.experiences.filter((item) => item.id !== id);
    library.updatedAt = new Date().toISOString();
    return library;
  }

  function profileCompleteness(libraryValue) {
    const library = normalizeLibrary(libraryValue);
    const profileKeys = ["name", "email", "phone", "education", "school", "major", "skills"];
    const profileFilled = profileKeys.filter((key) => library.profile[key]).length;
    const starFields = library.experiences.flatMap((item) => [item.situation, item.task, item.action, item.result]);
    const starFilled = starFields.filter(Boolean).length;
    const denominator = profileKeys.length + Math.max(4, starFields.length);
    const numerator = profileFilled + starFilled;
    return {
      percent: Math.round((numerator / denominator) * 100),
      profileFilled,
      profileTotal: profileKeys.length,
      starFilled,
      starTotal: starFields.length,
      experienceCount: library.experiences.length
    };
  }

  function experienceToMarkdown(item) {
    const label = TYPE_LABELS[item.type] || TYPE_LABELS.other;
    return [
      `## ${item.title || label}`,
      `- 类型：${label}`,
      `- 组织：${item.organization || "待确认"}`,
      `- 时间：${[item.startDate, item.endDate].filter(Boolean).join(" - ") || "待确认"}`,
      `- 情境：${item.situation || "待补充"}`,
      `- 任务：${item.task || "待补充"}`,
      `- 行动：${item.action || "待补充"}`,
      `- 结果：${item.result || "待补充"}`,
      `- 技能：${item.skills || "待补充"}`
    ].join("\n");
  }

  function buildKnowledgeBase(libraryValue) {
    const library = normalizeLibrary(libraryValue);
    const profile = library.profile;
    const sections = [
      "# 基础信息",
      `- 姓名：${profile.name || "待确认"}`,
      `- 手机号：${profile.phone || "待确认"}`,
      `- 邮箱：${profile.email || "待确认"}`,
      `- 所在城市：${profile.city || "待确认"}`,
      `- 职业定位：${profile.headline || "待确认"}`,
      "",
      "# 教育经历",
      `- 最高学历：${profile.education || "待确认"}`,
      `- 最高学历毕业院校：${profile.school || "待确认"}`,
      `- 专业：${profile.major || "待确认"}`,
      `- 教育结束日期：${profile.graduation || "待确认"}`,
      "",
      "# 能力信息",
      `- 技能：${profile.skills || "待确认"}`,
      `- 语言能力：${profile.languages || "待确认"}`,
      `- 证书：${profile.certificates || "待确认"}`,
      "",
      "# 经历库"
    ];
    library.experiences.forEach((item) => {
      sections.push("", experienceToMarkdown(item));
    });
    library.sources.forEach((source) => {
      if (source.text) sections.push("", `# 原始材料：${source.name}`, source.text);
    });
    return sections.join("\n");
  }

  function hasTerm(text, term) {
    if (!term) return false;
    if (/^[A-Za-z0-9+.#/ -]+$/.test(term)) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
    }
    return text.includes(term);
  }

  function scoreExperience(item, job) {
    const text = Object.values(item).join(" ");
    const keywordScore = job.keywords.reduce((score, keyword) => score + (hasTerm(text, keyword.term) ? 3 : 0), 0);
    const roleScore = job.role !== "目标岗位" && text.includes(job.role.replace(/实习生|经理|专员|助理|管培生/g, "")) ? 2 : 0;
    const completenessScore = [item.situation, item.task, item.action, item.result].filter(Boolean).length;
    return keywordScore + roleScore + completenessScore;
  }

  function stripPunctuation(value) {
    return clean(value).replace(/[。；;，,\s]+$/, "");
  }

  function buildStarBullet(item) {
    const context = [];
    if (item.situation) context.push(`针对${stripPunctuation(item.situation)}`);
    if (item.task) context.push(stripPunctuation(item.task));
    const action = item.action ? stripPunctuation(item.action) : "行动待补充";
    const rawResult = item.result ? stripPunctuation(item.result) : "效果或数据待确认";
    const result = item.result && !/^(?:最终|实现|促使|使得|推动|完成|达成|获得|取得)/.test(rawResult)
      ? `最终${rawResult}`
      : rawResult;
    return `${context.length ? `${context.join("，")}；` : ""}${action}；${result}。`;
  }

  function experienceMissingFields(item) {
    const missing = [];
    if (!item.situation) missing.push("情境");
    if (!item.task) missing.push("任务");
    if (!item.action) missing.push("行动");
    if (!item.result) missing.push("结果");
    return missing;
  }

  function buildPortrait(libraryValue) {
    const library = normalizeLibrary(libraryValue);
    const profile = library.profile;
    const types = unique(library.experiences.map((item) => TYPE_LABELS[item.type]));
    const skills = splitSkillText(profile.skills);
    return {
      title: profile.headline || (profile.major ? `${profile.major}背景候选人` : "个人定位待补充"),
      summary: library.experiences.length
        ? `已沉淀 ${library.experiences.length} 段经历，覆盖${types.join("、") || "多类实践"}；当前技能标签为${skills.slice(0, 6).join("、") || "待补充"}。`
        : "经历库还是空的。可以先添加一段经历，或导入现有简历。",
      types,
      skills,
      sourceCount: library.sources.length
    };
  }

  function generateStarResume(inputs, libraryValue) {
    const library = normalizeLibrary(libraryValue);
    const profile = library.profile;
    const job = assistant.extractJobSignals(inputs.jdText || "", inputs.company || "", inputs.role || "");
    const ranked = library.experiences
      .map((item, index) => ({ item, index, score: scoreExperience(item, job) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const skills = splitSkillText(profile.skills);
    const selectedSkills = skills
      .map((skill, index) => ({
        skill,
        index,
        score: job.keywords.reduce((score, keyword) => score + (hasTerm(skill, keyword.term) || hasTerm(keyword.term, skill) ? 1 : 0), 0)
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.skill)
      .slice(0, 10);
    const selectedRanked = ranked.slice(0, 6);
    const topTitles = selectedRanked.slice(0, 2).map(({ item }) => item.title).filter(Boolean);
    const summary = library.experiences.length
      ? `${profile.education || "教育背景待确认"}${profile.major ? ` · ${profile.major}` : ""}，具备${selectedSkills.slice(0, 5).join("、") || "岗位相关"}经验；${topTitles.length ? `重点经历包括${topTitles.join("、")}` : "相关经历待补充"}，目标岗位为${job.role}。`
      : `待确认：简历库中还没有可用于生成${job.role}简历的经历。`;
    const experiences = selectedRanked.map(({ item, score }) => ({
      ...item,
      score,
      typeLabel: TYPE_LABELS[item.type] || TYPE_LABELS.other,
      bullet: buildStarBullet(item),
      missing: experienceMissingFields(item)
    }));
    const missing = [];
    ["name", "phone", "email", "education", "school", "major"].forEach((field) => {
      if (!profile[field]) missing.push(`个人信息缺少：${PROFILE_LABELS[field]}`);
    });
    experiences.forEach((item) => {
      if (item.missing.length) missing.push(`${item.title}：缺少 ${item.missing.join("、")}`);
    });

    const lines = [
      `# ${profile.name || "姓名待确认"}｜${job.role}`,
      "",
      [profile.phone, profile.email, profile.city].filter(Boolean).join("｜") || "联系方式待确认",
      "",
      "## 求职概述",
      summary,
      "",
      "## 教育背景",
      `${profile.school || "院校待确认"}｜${profile.major || "专业待确认"}｜${profile.education || "学历待确认"}${profile.graduation ? `｜${profile.graduation}` : ""}`,
      "",
      "## 核心技能",
      selectedSkills.length ? selectedSkills.join("、") : "技能待补充",
      "",
      "## 相关经历"
    ];
    experiences.forEach((item) => {
      lines.push("", `### ${item.title || item.typeLabel}${item.organization ? `｜${item.organization}` : ""}`);
      if (item.startDate || item.endDate) lines.push(`${item.startDate || ""} - ${item.endDate || "至今"}`);
      lines.push(`- ${item.bullet}`);
    });

    return {
      meta: { company: job.company, role: job.role, sourceExperienceCount: library.experiences.length },
      profile: { ...profile },
      summary,
      skills: selectedSkills,
      experiences,
      missing,
      markdown: lines.join("\n")
    };
  }

  return {
    TYPE_LABELS,
    PROFILE_LABELS,
    createEmptyLibrary,
    normalizeLibrary,
    analyzeImportedResume,
    mergeImport,
    upsertExperience,
    removeExperience,
    profileCompleteness,
    buildKnowledgeBase,
    buildPortrait,
    generateStarResume,
    buildStarBullet
  };
});
