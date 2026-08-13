(function attachCampusJobs(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CampusJobs = factory();
  }
})(typeof self !== "undefined" ? self : this, function buildCampusJobs() {
  "use strict";

  function clean(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean).join("、");
    return String(value == null ? "" : value).replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  }

  function pick(source, keys) {
    for (const key of keys) {
      const value = clean(source[key]);
      if (value) return value;
    }
    return "";
  }

  function stableId(job, index) {
    const explicit = pick(job, ["id", "recordId", "记录ID", "记录 Id"]);
    if (explicit) return explicit;
    const seed = [
      pick(job, ["company", "公司", "企业", "公司名称"]),
      pick(job, ["role", "岗位", "岗位名称", "职位"]),
      pick(job, ["location", "工作地点", "地点", "城市"]),
      String(index)
    ].join("|");
    let hash = 0;
    for (let cursor = 0; cursor < seed.length; cursor += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(cursor)) | 0;
    }
    return `job-${Math.abs(hash).toString(36)}`;
  }

  function normalizeJob(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    const company = pick(source, ["company", "公司", "企业", "公司名称", "雇主"]);
    const role = pick(source, ["role", "岗位", "岗位名称", "职位", "招聘岗位"]);
    const description = pick(source, ["description", "岗位描述", "职位描述", "岗位职责", "工作内容", "JD"]);
    const requirements = pick(source, ["requirements", "任职要求", "岗位要求", "招聘要求", "要求"]);
    const bonus = pick(source, ["bonus", "加分项", "优先条件"]);
    const rawText = pick(source, ["rawText", "原始内容", "详情", "备注"]);
    return {
      id: stableId(source, index),
      company,
      role,
      category: pick(source, ["category", "岗位类别", "职能", "职类", "公司行业", "行业"]),
      location: pick(source, ["location", "工作地点", "地点", "城市"]),
      cohort: pick(source, ["cohort", "届别", "招聘对象", "面向人群"]),
      recruitmentType: pick(source, ["recruitmentType", "招聘类型", "招聘项目", "批次", "招聘批次"]),
      publishDate: pick(source, ["publishDate", "发布日期", "发布时间", "开始时间", "更新日期"]),
      deadline: pick(source, ["deadline", "截止日期", "网申截止", "截止时间"]),
      status: pick(source, ["status", "状态", "进度"]) || "招聘中",
      applyUrl: pick(source, ["applyUrl", "投递链接", "招聘链接", "申请链接", "网申地址", "官网", "链接"]),
      sourceUrl: pick(source, ["sourceUrl", "信息来源", "来源链接"]),
      description,
      requirements,
      bonus,
      rawText,
      tags: clean(source.tags || source["标签"] || source["关键词"])
        .split(/[、,，；;|/]+/)
        .map(clean)
        .filter(Boolean),
      importedAt: pick(source, ["importedAt", "导入时间"])
    };
  }

  function normalizeJobs(values) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    return values
      .map(normalizeJob)
      .filter((job) => job.company || job.role)
      .filter((job) => {
        const signature = [job.company, job.role, job.location, job.recruitmentType, job.publishDate, job.deadline, job.applyUrl].join("|");
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
  }

  function parseDelimited(text, delimiter) {
    const source = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const separator = delimiter || (source.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",");
    const records = [];
    let record = [];
    let field = "";
    let quoted = false;

    for (let cursor = 0; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quoted) {
        if (character === '"' && source[cursor + 1] === '"') {
          field += '"';
          cursor += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === separator) {
        record.push(field);
        field = "";
      } else if (character === "\n") {
        record.push(field.replace(/\r$/, ""));
        if (record.some((value) => clean(value))) records.push(record);
        record = [];
        field = "";
      } else {
        field += character;
      }
    }
    record.push(field.replace(/\r$/, ""));
    if (record.some((value) => clean(value))) records.push(record);
    if (records.length < 2) return [];

    const headers = records[0].map((value, index) => clean(value) || `字段${index + 1}`);
    return records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, clean(values[index])])));
  }

  function importAutumnJobs(text, delimiter) {
    const rows = parseDelimited(text, delimiter);
    const hasRecruitmentType = rows.some((row) => pick(row, ["recruitmentType", "招聘类型", "招聘项目", "批次", "招聘批次"]));
    const autumnRows = hasRecruitmentType
      ? rows.filter((row) => /秋招/.test(pick(row, ["recruitmentType", "招聘类型", "招聘项目", "批次", "招聘批次"])))
      : rows;
    const validCount = autumnRows.map(normalizeJob).filter((job) => job.company || job.role).length;
    const jobs = normalizeJobs(autumnRows);
    return {
      sourceCount: rows.length,
      autumnCount: autumnRows.length,
      excludedCount: rows.length - autumnRows.length,
      invalidCount: autumnRows.length - validCount,
      duplicateCount: validCount - jobs.length,
      jobs
    };
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function facets(jobs) {
    return {
      categories: unique(jobs.map((job) => job.category)).sort((a, b) => a.localeCompare(b, "zh-CN")),
      locations: unique(jobs.map((job) => job.location)).sort((a, b) => a.localeCompare(b, "zh-CN")),
      cohorts: unique(jobs.map((job) => job.cohort)).sort((a, b) => a.localeCompare(b, "zh-CN"))
    };
  }

  function filterJobs(jobs, filters) {
    const query = clean(filters && filters.query).toLowerCase();
    const category = clean(filters && filters.category);
    const location = clean(filters && filters.location);
    const cohort = clean(filters && filters.cohort);
    return normalizeJobs(jobs).filter((job) => {
      const haystack = Object.values(job).flat().join(" ").toLowerCase();
      return (!query || haystack.includes(query))
        && (!category || job.category === category)
        && (!location || job.location === location)
        && (!cohort || job.cohort === cohort);
    });
  }

  function buildJd(jobValue) {
    const job = normalizeJob(jobValue);
    const sections = [];
    if (job.description) sections.push("岗位职责：", job.description);
    if (job.requirements) sections.push("任职要求：", job.requirements);
    if (job.bonus) sections.push("加分项：", job.bonus);
    if (!sections.length && job.rawText) sections.push(job.rawText);
    return sections.join("\n");
  }

  function toApplicationPayload(jobValue) {
    const job = normalizeJob(jobValue);
    return {
      company: job.company,
      role: job.role,
      jd: buildJd(job),
      sourceUrl: job.applyUrl || job.sourceUrl,
      job
    };
  }

  return { normalizeJob, normalizeJobs, parseDelimited, importAutumnJobs, facets, filterJobs, buildJd, toApplicationPayload };
});
