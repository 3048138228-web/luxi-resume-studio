(function boot() {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const inputs = {
    company: $("#companyInput"),
    role: $("#roleInput"),
    jd: $("#jdInput"),
    resume: $("#resumeInput"),
    form: $("#formInput")
  };
  const counters = {
    jd: $("#jdCount"),
    resume: $("#resumeCount"),
    form: $("#formCount")
  };
  const analyzeBtn = $("#analyzeBtn");
  const clearBtn = $("#clearBtn");
  const sampleBtn = $("#sampleBtn");
  const copyBtn = $("#copyBtn");
  const resultPanel = $("#resultPanel");
  const resultMeta = $("#resultMeta");
  const statusText = $("#statusText");
  const summaryText = $("#summaryText");
  const selectedJobSummary = $("#selectedJobSummary");
  const copyFallback = $("#copyFallback");
  const copyFallbackText = $("#copyFallbackText");
  const closeCopyFallbackBtn = $("#closeCopyFallback");
  const tabs = Array.from(document.querySelectorAll(".tab"));

  let currentResult = null;
  let currentTab = "fullResume";
  let copyPayloads = [];

  const emptyState = `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">↗</span>
      <h3>等待目标岗位</h3>
      <p>系统会从个人简历库中寻找最相关证据，并按 STAR 生成完整简历。</p>
      <ol>
        <li><span>1</span> 分析岗位要求</li>
        <li><span>2</span> 调取相关经历</li>
        <li><span>3</span> 编排完整简历</li>
      </ol>
    </div>
  `;

  const sample = {
    company: "星河科技",
    role: "用户运营实习生",
    jd: [
      "岗位职责：",
      "1. 负责用户增长活动的数据整理、复盘和优化建议。",
      "2. 协助运营公众号、社群和活动页面，提升用户转化与留存。",
      "3. 跟进跨部门沟通，推进活动上线和效果分析。",
      "任职要求：",
      "1. 熟练使用 Excel，有数据分析、内容运营或活动策划经验。",
      "2. 具备较强的文案写作、沟通协调和复盘能力。",
      "加分项：",
      "1. 有 SQL、Python、公众号运营经验优先。"
    ].join("\n"),
    resume: "",
    form: ["自我评价", "相关实习经历", "项目经历", "求职动机", "每周可实习天数", "是否接受调剂"].join("\n")
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(text, state = "neutral") {
    statusText.textContent = text;
    statusText.dataset.state = state;
  }

  function getPayload() {
    const libraryText = window.ResumeLibraryApp ? window.ResumeLibraryApp.getKnowledgeBase() : "";
    return {
      company: inputs.company.value,
      role: inputs.role.value,
      jdText: inputs.jd.value,
      resumeText: [libraryText, inputs.resume.value].filter((item) => item.trim()).join("\n\n# 本次投递临时补充\n"),
      formText: inputs.form.value
    };
  }

  function applySelectedJob(job, announce = true) {
    if (!job) {
      selectedJobSummary.hidden = true;
      selectedJobSummary.innerHTML = "";
      return;
    }
    const payload = window.CampusJobs.toApplicationPayload(job);
    inputs.company.value = payload.company;
    inputs.role.value = payload.role;
    inputs.jd.value = payload.jd;
    const meta = [job.location, job.category, job.cohort, job.recruitmentType].filter(Boolean);
    selectedJobSummary.hidden = false;
    selectedJobSummary.innerHTML = `
      <span class="selected-job-index">01</span>
      <div><span class="eyebrow">TARGET JOB</span><h3>${escapeHtml([job.company, job.role].filter(Boolean).join(" · ") || "目标岗位")}</h3><p>${escapeHtml(meta.join(" · ") || "岗位信息已从秋招岗位库带入")}</p></div>
      <button type="button" class="ghost" data-change-job>更换岗位</button>
    `;
    updateCounters();
    if (announce) setStatus("岗位信息已带入，请确认后生成。", "success");
  }

  function requireAnyInput(payload) {
    return [payload.company, payload.role, payload.jdText].some((item) => item.trim());
  }

  function updateCounters() {
    Object.entries(counters).forEach(([key, counter]) => {
      counter.textContent = `${inputs[key].value.length} 字`;
    });
  }

  function registerCopy(text, label = "复制") {
    const index = copyPayloads.push(text) - 1;
    return `<button type="button" class="inline-copy" data-copy-index="${index}" aria-label="${escapeHtml(label)}">复制</button>`;
  }

  function splitLead(item) {
    const parts = String(item).split("：");
    if (parts.length < 2) return { label: "要点", value: item };
    return { label: parts.shift(), value: parts.join("：") };
  }

  function renderDefinitionCards(items) {
    return `<div class="definition-grid">${items.map((item) => {
      const { label, value } = splitLead(item);
      return `
        <article class="definition-card">
          <span>${escapeHtml(label)}</span>
          <p>${escapeHtml(value)}</p>
        </article>
      `;
    }).join("")}</div>`;
  }

  function renderList(items, className = "") {
    return `<ul class="result-list ${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderFullResume(result) {
    const resume = result.fullResume;
    const profile = resume.profile;
    const contact = [profile.phone, profile.email, profile.city].filter(Boolean).join(" · ");
    const experiences = resume.experiences.map((item) => `
      <article class="generated-experience">
        <header>
          <div><span>${escapeHtml(item.typeLabel)}</span><h4>${escapeHtml(item.title || item.typeLabel)}${item.organization ? `｜${escapeHtml(item.organization)}` : ""}</h4><p>${escapeHtml([item.startDate, item.endDate].filter(Boolean).join(" - "))}</p></div>
          <span class="star-score ${item.missing.length ? "" : "complete"}">${4 - item.missing.length}/4 STAR</span>
        </header>
        <p class="generated-bullet">${escapeHtml(item.bullet)}</p>
        ${item.missing.length ? `<footer>待补充：${escapeHtml(item.missing.join("、"))}</footer>` : ""}
      </article>
    `).join("");
    return `
      <section class="result-section full-resume-section">
        <div class="result-heading">
          <div><span class="eyebrow">COMPLETE RESUME</span><h3>岗位定制完整简历</h3></div>
          ${registerCopy(resume.markdown, "复制完整简历")}
        </div>
        <article class="resume-paper">
          <header class="resume-paper-header">
            <div><h2>${escapeHtml(profile.name || "姓名待确认")}</h2><p>${escapeHtml(resume.meta.role)}</p></div>
            <span>${escapeHtml(contact || "联系方式待确认")}</span>
          </header>
          <section><h3>求职概述</h3><p>${escapeHtml(resume.summary)}</p></section>
          <section><h3>教育背景</h3><p>${escapeHtml(`${profile.school || "院校待确认"}｜${profile.major || "专业待确认"}｜${profile.education || "学历待确认"}${profile.graduation ? `｜${profile.graduation}` : ""}`)}</p></section>
          <section><h3>核心技能</h3><div class="resume-skill-list">${resume.skills.length ? renderTags(resume.skills) : "<span>技能待补充</span>"}</div></section>
          <section><h3>相关经历</h3><div class="generated-experience-list">${experiences || '<div class="mini-empty">简历库中还没有经历，请先返回个人简历库补充。</div>'}</div></section>
        </article>
        <aside class="resume-gap-panel ${resume.missing.length ? "" : "complete"}">
          <div><span class="eyebrow">EVIDENCE CHECK</span><h3>${resume.missing.length ? `${resume.missing.length} 项需要补充` : "证据结构完整"}</h3></div>
          ${resume.missing.length ? renderList(resume.missing.slice(0, 12), "risk-list") : "<p>当前入选经历均已填写完整 STAR，提交前仍需核对事实。</p>"}
        </aside>
      </section>
    `;
  }

  function renderTags(items) {
    return items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function renderProfile(result) {
    return `
      <section class="result-section">
        <div class="result-heading">
          <div>
            <span class="eyebrow">JOB PROFILE</span>
            <h3>${escapeHtml(result.profile.title)}</h3>
          </div>
          <span class="verified-badge">基于 JD 提取</span>
        </div>
        ${renderDefinitionCards(result.profile.bullets)}
      </section>
    `;
  }

  function renderMatch(result) {
    const score = Math.max(0, Math.min(100, Number(result.match.score) || 0));
    return `
      <section class="result-section">
        <div class="match-overview">
          <div class="score-ring" style="--score: ${score * 3.6}deg" aria-label="关键词匹配度 ${score} 分">
            <div><strong>${score}</strong><span>/ 100</span></div>
          </div>
          <div class="score-copy">
            <span class="eyebrow">KEYWORD FIT</span>
            <h3>关键词匹配度</h3>
            <p>只表示 JD 关键词与材料证据的重合程度，不等同于录用概率。</p>
          </div>
        </div>
        <div class="metric-row">
          <article class="metric"><span class="metric-value">${result.meta.matchedCount}</span><span class="metric-label">命中关键词</span></article>
          <article class="metric"><span class="metric-value">${result.meta.missingCount}</span><span class="metric-label">证据缺口</span></article>
          <article class="metric"><span class="metric-value">${result.meta.fieldCount}</span><span class="metric-label">表单字段</span></article>
        </div>
        ${renderList(result.match.bullets, "analysis-list")}
      </section>
    `;
  }

  function renderResume(result) {
    const summary = result.tailoredResume.summary;
    const bulletText = result.tailoredResume.bullets.join("\n");
    return `
      <section class="result-section">
        <div class="result-heading">
          <div><span class="eyebrow">TAILORED RESUME</span><h3>定制简历建议</h3></div>
          <span class="verified-badge">不新增事实</span>
        </div>
        <article class="copy-block featured">
          <header><span>简历摘要</span>${registerCopy(summary, "复制简历摘要")}</header>
          <p>${escapeHtml(summary)}</p>
        </article>
        <article class="copy-block">
          <header><span>经历改写</span>${registerCopy(bulletText, "复制经历改写")}</header>
          ${renderList(result.tailoredResume.bullets)}
        </article>
        <div class="suggestion-grid">
          <article class="suggestion-card"><span>技能排序</span><p>${escapeHtml(result.tailoredResume.skillOrder)}</p></article>
          <article class="suggestion-card"><span>模板方向</span><p>${escapeHtml(result.tailoredResume.positioning)}</p></article>
        </div>
      </section>
    `;
  }

  function renderFields(result) {
    const cards = result.formAnswers.map((item, index) => {
      const pending = item.status === "pending";
      return `
        <article class="answer-card ${pending ? "pending" : "ready"}">
          <header>
            <div><span class="answer-index">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.label)}</h3></div>
            <div class="answer-actions">
              <span class="answer-status">${pending ? "待确认" : "可使用"}</span>
              ${registerCopy(item.answer, `复制${item.label}`)}
            </div>
          </header>
          <div class="answer-body">
            <span>建议填写</span>
            <p>${escapeHtml(item.answer)}</p>
          </div>
          <details>
            <summary>查看生成依据</summary>
            <dl>
              <div><dt>填写理由</dt><dd>${escapeHtml(item.reason)}</dd></div>
              <div><dt>提交前确认</dt><dd>${escapeHtml(item.confirmation)}</dd></div>
            </dl>
          </details>
        </article>
      `;
    }).join("");
    return `
      <section class="result-section">
        <div class="result-heading">
          <div><span class="eyebrow">FORM ANSWERS</span><h3>逐项填写稿</h3></div>
          <span class="verified-badge">${result.formAnswers.length} 个字段</span>
        </div>
        <div class="answer-list">${cards}</div>
      </section>
    `;
  }

  function renderRisks(result) {
    return `
      <section class="result-section risks">
        <div class="result-heading">
          <div><span class="eyebrow">FINAL CHECK</span><h3>提交前检查</h3></div>
          <span class="risk-badge">请逐项核对</span>
        </div>
        ${renderList(result.risks, "risk-list")}
      </section>
    `;
  }

  function renderMarkdown(result) {
    return `
      <section class="result-section">
        <div class="result-heading">
          <div><span class="eyebrow">RESUME MARKDOWN</span><h3>完整简历 Markdown</h3></div>
          ${registerCopy(result.fullResume.markdown, "复制完整简历 Markdown")}
        </div>
        <pre class="markdown-output">${escapeHtml(result.fullResume.markdown)}</pre>
      </section>
    `;
  }

  function setActiveTab(tabName) {
    currentTab = tabName;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === currentTab;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  }

  function renderCurrentTab() {
    if (!currentResult) return;
    const renderers = {
      fullResume: renderFullResume,
      profile: renderProfile,
      match: renderMatch,
      resume: renderResume,
      fields: renderFields,
      risks: renderRisks,
      markdown: renderMarkdown
    };
    copyPayloads = [];
    resultPanel.classList.remove("empty");
    resultPanel.innerHTML = renderers[currentTab](currentResult);
  }

  function renderMeta(result) {
    const pendingCount = result.fullResume.missing.length;
    resultMeta.hidden = false;
    resultMeta.innerHTML = `
      <span><b>${result.meta.matchedCount}</b> 项证据命中</span>
      <span><b>${result.fullResume.experiences.length}</b> 段经历入选</span>
      <span class="${pendingCount ? "has-pending" : ""}"><b>${pendingCount}</b> 项证据缺口</span>
    `;
  }

  function runAnalysis() {
    const payload = getPayload();
    if (!requireAnyInput(payload)) {
      setStatus("请先填写目标岗位或粘贴 JD。", "error");
      inputs.jd.focus();
      return;
    }

    analyzeBtn.disabled = true;
    setStatus("正在整理材料……");
    try {
      const library = window.ResumeLibraryApp ? window.ResumeLibraryApp.getLibrary() : window.ResumeLibrary.createEmptyLibrary();
      currentResult = window.JobAssistant.analyzeApplication(payload);
      currentResult.analysisMarkdown = currentResult.markdown;
      currentResult.fullResume = window.ResumeLibrary.generateStarResume(payload, library);
      copyBtn.disabled = false;
      summaryText.textContent = `${currentResult.meta.company} · ${currentResult.meta.role}`;
      setActiveTab("fullResume");
      renderMeta(currentResult);
      renderCurrentTab();
      setStatus("岗位定制简历已生成。", "success");
    } catch (error) {
      setStatus("生成失败，请检查输入格式后重试。", "error");
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  function fillSample() {
    Object.entries(sample).forEach(([key, value]) => {
      inputs[key].value = value;
    });
    selectedJobSummary.hidden = true;
    selectedJobSummary.innerHTML = "";
    updateCounters();
    setStatus("示例已填入，可以直接生成。", "success");
  }

  function clearAll() {
    Object.values(inputs).forEach((input) => {
      input.value = "";
    });
    currentResult = null;
    selectedJobSummary.hidden = true;
    selectedJobSummary.innerHTML = "";
    copyPayloads = [];
    copyBtn.disabled = true;
    summaryText.textContent = "等待输入目标岗位。";
    resultMeta.hidden = true;
    resultMeta.innerHTML = "";
    resultPanel.classList.add("empty");
    resultPanel.innerHTML = emptyState;
    setActiveTab("fullResume");
    updateCounters();
    setStatus("内容已清空。", "neutral");
  }

  async function writeClipboard(text) {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand("copy");
    temporary.remove();
    if (copied) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("Clipboard unavailable");
  }

  function showManualCopy(text) {
    copyFallbackText.value = text;
    copyFallback.hidden = false;
    copyFallbackText.focus();
    copyFallbackText.select();
    setStatus("内容已选中，请按 ⌘ / Ctrl + C。", "neutral");
  }

  function closeManualCopy() {
    copyFallback.hidden = true;
    copyFallbackText.value = "";
  }

  async function copyReport() {
    if (!currentResult) return;
    await writeClipboard(currentResult.fullResume.markdown);
    setStatus("完整简历已复制。", "success");
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
      renderCurrentTab();
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });

  Object.entries(inputs).forEach(([key, input]) => {
    if (counters[key]) input.addEventListener("input", updateCounters);
  });

  resultPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-index]");
    if (!button) return;
    const text = copyPayloads[Number(button.dataset.copyIndex)];
    writeClipboard(text)
      .then(() => {
        button.textContent = "已复制";
        setStatus("该段内容已复制。", "success");
        window.setTimeout(() => { button.textContent = "复制"; }, 1200);
      })
      .catch(() => showManualCopy(text));
  });

  selectedJobSummary.addEventListener("click", (event) => {
    if (!event.target.closest("[data-change-job]")) return;
    if (window.ResumeLibraryApp) window.ResumeLibraryApp.setMode("jobs");
  });

  window.addEventListener("campus-job-selected", (event) => applySelectedJob(event.detail.job));

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runAnalysis();
    }
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  clearBtn.addEventListener("click", clearAll);
  sampleBtn.addEventListener("click", fillSample);
  copyBtn.addEventListener("click", () => {
    copyReport().catch(() => showManualCopy(currentResult.fullResume.markdown));
  });
  closeCopyFallbackBtn.addEventListener("click", closeManualCopy);
  copyFallback.addEventListener("click", (event) => {
    if (event.target === copyFallback) closeManualCopy();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !copyFallback.hidden) closeManualCopy();
  });

  updateCounters();
  if (window.CampusJobsApp) applySelectedJob(window.CampusJobsApp.getSelectedJob(), false);
})();
