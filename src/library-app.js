(function bootResumeLibrary() {
  "use strict";

  const STORAGE_KEY = "luxi.resume-library.v1";
  const SERVER_SYNC_KEY = "luxi.resume-library.server-sync.v1";
  const SERVER_SYNC_VERSION = "2026-07-24";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const core = window.ResumeLibrary;

  const elements = {
    jobsWorkspace: $("#jobsWorkspace"),
    libraryWorkspace: $("#libraryWorkspace"),
    applicationWorkspace: $("#applicationWorkspace"),
    navCount: $("#libraryNavCount"),
    completenessText: $("#completenessText"),
    completenessBar: $("#completenessBar"),
    completenessHint: $("#completenessHint"),
    profileForm: $("#profileForm"),
    profileStatus: $("#profileStatus"),
    fileInput: $("#resumeFileInput"),
    uploadStatus: $("#uploadStatus"),
    importPreview: $("#importPreview"),
    importPreviewTitle: $("#importPreviewTitle"),
    importStats: $("#importStats"),
    importPreviewBody: $("#importPreviewBody"),
    confirmImport: $("#confirmImportBtn"),
    cancelImport: $("#cancelImportBtn"),
    experienceForm: $("#experienceForm"),
    experienceId: $("#experienceId"),
    experienceType: $("#experienceType"),
    experienceTitle: $("#experienceTitle"),
    experienceOrganization: $("#experienceOrganization"),
    experienceStart: $("#experienceStart"),
    experienceEnd: $("#experienceEnd"),
    experienceSituation: $("#experienceSituation"),
    experienceTask: $("#experienceTask"),
    experienceAction: $("#experienceAction"),
    experienceResult: $("#experienceResult"),
    experienceSkills: $("#experienceSkills"),
    experienceSubmitText: $("#experienceSubmitText"),
    cancelExperienceEdit: $("#cancelExperienceEditBtn"),
    experienceStatus: $("#experienceStatus"),
    memoryUpdated: $("#memoryUpdatedText"),
    experienceCount: $("#experienceCount"),
    sourceCount: $("#sourceCount"),
    starCount: $("#starCount"),
    portraitTitle: $("#portraitTitle"),
    portraitSummary: $("#portraitSummary"),
    portraitTags: $("#portraitTags"),
    experienceListCount: $("#experienceListCount"),
    experienceList: $("#experienceList"),
    sourceListCount: $("#sourceListCount"),
    sourceList: $("#sourceList"),
    exportLibrary: $("#exportLibraryBtn"),
    clearLibrary: $("#clearLibraryBtn"),
    loadSample: $("#loadLibrarySampleBtn"),
    libraryContext: $("#libraryContextText"),
    librarySourceSummary: $("#librarySourceSummary"),
    goToLibrary: $("#goToLibraryBtn"),
    continueToCustomize: $("#continueToCustomizeBtn")
  };

  let library = loadLibrary();
  let pendingImport = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadLibrary() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return core.normalizeLibrary(saved ? JSON.parse(saved) : null);
    } catch (error) {
      return core.createEmptyLibrary();
    }
  }

  function hasLibraryData(value) {
    const normalized = core.normalizeLibrary(value);
    return normalized.experiences.length
      || normalized.sources.length
      || Object.values(normalized.profile).some(Boolean);
  }

  function libraryTimestamp(value) {
    const timestamp = Date.parse(value && value.updatedAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function mergeFirstServerSync(serverLibrary, cachedLibrary) {
    const shared = core.normalizeLibrary(serverLibrary);
    const cached = core.normalizeLibrary(cachedLibrary);
    const isSample = cached.profile.name === "林晓舟"
      && cached.experiences.length
      && cached.experiences.every((item) => item.source === "示例数据");
    if (!hasLibraryData(cached) || isSample) return shared;

    Object.keys(shared.profile).forEach((field) => {
      if (!shared.profile[field] && cached.profile[field]) shared.profile[field] = cached.profile[field];
    });
    const experienceSignatures = new Set(shared.experiences.map((item) => [
      item.title, item.organization, item.startDate, item.action
    ].join("|")));
    cached.experiences.forEach((item) => {
      const signature = [item.title, item.organization, item.startDate, item.action].join("|");
      if (!experienceSignatures.has(signature)) {
        shared.experiences.push(item);
        experienceSignatures.add(signature);
      }
    });
    const sourceSignatures = new Set(shared.sources.map((item) => `${item.name}|${item.text}`));
    cached.sources.forEach((item) => {
      const signature = `${item.name}|${item.text}`;
      if (!sourceSignatures.has(signature)) {
        shared.sources.push(item);
        sourceSignatures.add(signature);
      }
    });
    shared.updatedAt = libraryTimestamp(cached) > libraryTimestamp(shared)
      ? cached.updatedAt
      : shared.updatedAt;
    return core.normalizeLibrary(shared);
  }

  function serverSyncEnabled() {
    return location.protocol === "http:"
      && ["127.0.0.1", "localhost"].includes(location.hostname);
  }

  function cacheLibrary(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  async function writeLibraryToServer(value) {
    if (!serverSyncEnabled()) return;
    const response = await fetch("/api/resume-library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`本地简历库保存失败（${response.status}）`);
  }

  async function syncLibraryWithServer() {
    if (!serverSyncEnabled()) return;
    try {
      const response = await fetch("/api/resume-library", { cache: "no-store" });
      if (!response.ok) throw new Error(`本地简历库读取失败（${response.status}）`);
      const shared = core.normalizeLibrary(await response.json());
      const firstSync = localStorage.getItem(SERVER_SYNC_KEY) !== SERVER_SYNC_VERSION;

      if (firstSync) {
        library = mergeFirstServerSync(shared, library);
        await writeLibraryToServer(library);
        localStorage.setItem(SERVER_SYNC_KEY, SERVER_SYNC_VERSION);
      } else if (hasLibraryData(library) && libraryTimestamp(library) > libraryTimestamp(shared)) {
        await writeLibraryToServer(library);
      } else {
        library = shared;
      }

      cacheLibrary(library);
      populateProfileForm();
      renderLibrary();
      window.dispatchEvent(new CustomEvent("resume-library-updated", { detail: { library: getLibrary() } }));
      setStatus(elements.profileStatus, `已从 APP 简历库载入 ${library.experiences.length} 段经历。`, "success");
    } catch (error) {
      setStatus(elements.profileStatus, "APP 简历库暂时无法同步，当前显示浏览器缓存。", "error");
    }
  }

  function setStatus(element, message, state = "neutral") {
    element.textContent = message;
    element.dataset.state = state;
  }

  function saveLibrary(nextLibrary, message) {
    library = core.normalizeLibrary(nextLibrary);
    library.updatedAt = new Date().toISOString();
    const persisted = cacheLibrary(library);
    if (!persisted) setStatus(elements.profileStatus, "浏览器缓存不可用，正在尝试保存到 APP 简历库。", "error");
    renderLibrary();
    window.dispatchEvent(new CustomEvent("resume-library-updated", { detail: { library: getLibrary() } }));
    if (message && persisted) setStatus(elements.profileStatus, message, "success");
    writeLibraryToServer(library).catch(() => {
      setStatus(elements.profileStatus, "未能写入 APP 简历库，请确认终端中的服务仍在运行。", "error");
    });
  }

  function getLibrary() {
    return core.normalizeLibrary(JSON.parse(JSON.stringify(library)));
  }

  function getKnowledgeBase() {
    return core.buildKnowledgeBase(library);
  }

  function formatUpdated(value) {
    if (!value) return "尚未保存资料";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "已保存在当前浏览器";
    return `最近保存：${date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }

  function populateProfileForm() {
    $$('[data-profile-field]').forEach((input) => {
      input.value = library.profile[input.dataset.profileField] || "";
    });
  }

  function renderTags(items) {
    return (items || []).slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function starRow(letter, label, value) {
    return `
      <div class="star-memory-row ${value ? "filled" : "missing"}">
        <b>${letter}</b><span>${escapeHtml(label)}</span><p>${escapeHtml(value || "待补充")}</p>
      </div>
    `;
  }

  function renderExperience(item) {
    const typeLabel = core.TYPE_LABELS[item.type] || core.TYPE_LABELS.other;
    const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");
    const completeCount = [item.situation, item.task, item.action, item.result].filter(Boolean).length;
    return `
      <article class="memory-experience-card">
        <header>
          <div><span class="experience-type">${escapeHtml(typeLabel)}</span><h4>${escapeHtml(item.title || "未命名经历")}</h4><p>${escapeHtml([item.organization, dates].filter(Boolean).join(" · ") || "组织与时间待补充")}</p></div>
          <div class="experience-card-actions"><span class="star-score ${completeCount === 4 ? "complete" : ""}">${completeCount}/4 STAR</span><button type="button" class="inline-copy" data-exp-action="edit" data-exp-id="${escapeHtml(item.id)}">编辑</button><button type="button" class="inline-copy danger-text" data-exp-action="delete" data-exp-id="${escapeHtml(item.id)}">删除</button></div>
        </header>
        <div class="star-memory-grid">
          ${starRow("S", "情境", item.situation)}
          ${starRow("T", "任务", item.task)}
          ${starRow("A", "行动", item.action)}
          ${starRow("R", "结果", item.result)}
        </div>
        ${item.skills ? `<div class="experience-skills">${renderTags(item.skills.split(/[、,，；;]+/))}</div>` : ""}
        ${item.source ? `<footer>来源：${escapeHtml(item.source)}${item.imported ? " · 自动提取后待复核" : ""}</footer>` : ""}
      </article>
    `;
  }

  function renderSource(item) {
    const importedAt = item.importedAt ? new Date(item.importedAt).toLocaleDateString("zh-CN") : "";
    return `
      <article class="source-item">
        <span class="source-file-icon" aria-hidden="true">${escapeHtml((item.type || "TXT").slice(0, 4).toUpperCase())}</span>
        <div><strong>${escapeHtml(item.name)}</strong><p>${item.text.length} 字${importedAt ? ` · ${importedAt}` : ""}</p></div>
      </article>
    `;
  }

  function renderLibrary() {
    const completeness = core.profileCompleteness(library);
    const portrait = core.buildPortrait(library);
    elements.completenessText.textContent = `${completeness.percent}%`;
    elements.completenessBar.style.width = `${completeness.percent}%`;
    elements.completenessHint.textContent = library.experiences.length
      ? `基础档案 ${completeness.profileFilled}/${completeness.profileTotal} 项，STAR 已填写 ${completeness.starFilled}/${completeness.starTotal} 项。`
      : "先填写基础信息，再沉淀至少一段经历。";
    elements.memoryUpdated.textContent = formatUpdated(library.updatedAt);
    elements.experienceCount.textContent = String(library.experiences.length);
    elements.sourceCount.textContent = String(library.sources.length);
    elements.starCount.textContent = `${completeness.starFilled}/${completeness.starTotal}`;
    elements.portraitTitle.textContent = portrait.title;
    elements.portraitSummary.textContent = portrait.summary;
    elements.portraitTags.innerHTML = renderTags(portrait.skills.concat(portrait.types));
    elements.experienceListCount.textContent = `${library.experiences.length} 段`;
    elements.sourceListCount.textContent = `${library.sources.length} 份`;
    elements.navCount.textContent = `${library.experiences.length} 段经历`;
    elements.experienceList.innerHTML = library.experiences.length
      ? library.experiences.map(renderExperience).join("")
      : '<div class="mini-empty">还没有经历。左侧保存后会出现在这里。</div>';
    elements.sourceList.innerHTML = library.sources.length
      ? library.sources.map(renderSource).join("")
      : '<div class="mini-empty">导入的简历会保留文件名和原始文本。</div>';
    const context = `当前简历库有 ${library.experiences.length} 段经历、${library.sources.length} 份原始材料。`;
    elements.libraryContext.textContent = `${context} 生成时会优先调用与 JD 最相关的证据。`;
    elements.librarySourceSummary.textContent = `${context} 将按 JD 自动排序调用。`;
  }

  function setMode(mode) {
    elements.jobsWorkspace.hidden = mode !== "jobs";
    elements.libraryWorkspace.hidden = mode !== "library";
    elements.applicationWorkspace.hidden = mode !== "application";
    $$(".mode-button").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function getProfileFromForm() {
    const profile = {};
    $$('[data-profile-field]').forEach((input) => {
      profile[input.dataset.profileField] = input.value.trim();
    });
    return profile;
  }

  function experienceFromForm() {
    return {
      id: elements.experienceId.value,
      type: elements.experienceType.value,
      title: elements.experienceTitle.value,
      organization: elements.experienceOrganization.value,
      startDate: elements.experienceStart.value,
      endDate: elements.experienceEnd.value,
      situation: elements.experienceSituation.value,
      task: elements.experienceTask.value,
      action: elements.experienceAction.value,
      result: elements.experienceResult.value,
      skills: elements.experienceSkills.value,
      source: "手动填写",
      imported: false
    };
  }

  function resetExperienceForm() {
    elements.experienceForm.reset();
    elements.experienceId.value = "";
    elements.experienceSubmitText.textContent = "保存这段经历";
    elements.cancelExperienceEdit.hidden = true;
  }

  function loadExperienceIntoForm(item) {
    elements.experienceId.value = item.id;
    elements.experienceType.value = item.type;
    elements.experienceTitle.value = item.title;
    elements.experienceOrganization.value = item.organization;
    elements.experienceStart.value = item.startDate;
    elements.experienceEnd.value = item.endDate;
    elements.experienceSituation.value = item.situation;
    elements.experienceTask.value = item.task;
    elements.experienceAction.value = item.action;
    elements.experienceResult.value = item.result;
    elements.experienceSkills.value = item.skills;
    elements.experienceSubmitText.textContent = "更新这段经历";
    elements.cancelExperienceEdit.hidden = false;
    elements.experienceForm.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.experienceTitle.focus();
  }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF 解析组件未加载，请刷新页面后重试。");
    const data = new Uint8Array(await file.arrayBuffer());
    const documentTask = window.pdfjsLib.getDocument({ data });
    const pdf = await documentTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      content.items.forEach((item) => {
        pageText += `${item.str || ""}${item.hasEOL ? "\n" : " "}`;
      });
      pages.push(pageText.trim());
    }
    return pages.join("\n\n");
  }

  async function extractDocxText(file) {
    if (!window.mammoth) throw new Error("DOCX 解析组件未加载，请刷新页面后重试。");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || "";
  }

  function renderImportPreview(analysis) {
    const facts = Object.entries(analysis.profilePatch).filter(([, value]) => value);
    elements.importPreview.hidden = false;
    elements.importPreviewTitle.textContent = analysis.sourceName;
    elements.importStats.textContent = `${analysis.stats.factCount} 项事实 · ${analysis.stats.experienceCount} 段经历 · ${analysis.stats.skillCount} 个技能`;
    elements.importPreviewBody.innerHTML = `
      <div class="import-facts">${facts.length ? facts.map(([key, value]) => `<span><b>${escapeHtml(core.PROFILE_LABELS[key] || key)}</b>${escapeHtml(value)}</span>`).join("") : "<p>未识别到明确基础信息。</p>"}</div>
      <div class="import-experiences"><strong>拟写入的经历</strong>${analysis.experiences.length ? `<ul>${analysis.experiences.map((item) => `<li>${escapeHtml(item.title)}：${escapeHtml(item.action || "行动待补充")}</li>`).join("")}</ul>` : "<p>未识别到经历，请改用手动添加。</p>"}</div>
      <p class="import-note">自动提取只负责归档原文，不会自行补充情境、任务或成果。写入后请继续完善 STAR。</p>
    `;
  }

  async function handleFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    setStatus(elements.uploadStatus, `正在本地解析 ${file.name}……`);
    if (extension === "json") {
      const restored = core.normalizeLibrary(JSON.parse(await file.text()));
      pendingImport = { kind: "library", library: restored };
      elements.importPreview.hidden = false;
      elements.importPreviewTitle.textContent = file.name;
      elements.importStats.textContent = `${restored.experiences.length} 段经历 · ${restored.sources.length} 份材料`;
      elements.importPreviewBody.innerHTML = '<p class="import-note">这是简历库备份。确认后会替换当前浏览器中的简历库。</p>';
      setStatus(elements.uploadStatus, "JSON 备份读取完成，请确认恢复。", "success");
      return;
    }
    let text = "";
    if (["txt", "md"].includes(extension)) text = await file.text();
    else if (extension === "docx") text = await extractDocxText(file);
    else if (extension === "pdf") text = await extractPdfText(file);
    else throw new Error("暂不支持该文件格式。");
    if (!text.trim()) throw new Error("没有从文件中提取到文字；扫描版 PDF 请先做 OCR。 ");
    const analysis = core.analyzeImportedResume(text, file.name);
    pendingImport = { kind: "resume", analysis, sourceType: extension };
    renderImportPreview(analysis);
    setStatus(elements.uploadStatus, "解析完成。请检查预览后确认写入。", "success");
  }

  function cancelImport() {
    pendingImport = null;
    elements.importPreview.hidden = true;
    elements.importPreviewBody.innerHTML = "";
    elements.fileInput.value = "";
    setStatus(elements.uploadStatus, "");
  }

  function exportLibrary() {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `履析-个人简历库-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function sampleLibrary() {
    let sample = core.createEmptyLibrary();
    sample.profile = {
      ...sample.profile,
      name: "林晓舟",
      phone: "13800000000",
      email: "xiaozhou@example.com",
      city: "上海",
      headline: "用户运营 / 增长运营",
      education: "本科",
      school: "南方大学",
      major: "传播学",
      graduation: "2027.06",
      skills: "Excel、SQL、公众号运营、活动策划、数据复盘",
      languages: "英语 CET-6"
    };
    sample = core.upsertExperience(sample, {
      type: "internship",
      title: "用户运营实习",
      organization: "星河科技",
      startDate: "2025.06",
      endDate: "2025.09",
      situation: "新用户进入社群后首周活跃度偏低",
      task: "负责新用户内容触达与社群活跃提升",
      action: "按用户阶段设计内容排期，建立每周数据复盘表，并协同设计优化活动物料",
      result: "社群首周活跃率提升 18%，沉淀一套可复用的运营排期模板",
      skills: "Excel、社群运营、数据复盘、跨部门协作",
      source: "示例数据"
    });
    sample = core.upsertExperience(sample, {
      type: "project",
      title: "校园安全法治活动",
      organization: "校学生组织",
      startDate: "2024.10",
      endDate: "2024.12",
      situation: "校园安全主题活动参与度不足",
      task: "负责活动策划、传播与现场协调",
      action: "拆分宣传节奏，协调志愿者与物料，运营公众号进行预热和复盘",
      result: "完成 3 场主题活动，覆盖 600 余名学生",
      skills: "活动策划、公众号运营、项目协同",
      source: "示例数据"
    });
    return sample;
  }

  $$(".mode-button").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  elements.goToLibrary.addEventListener("click", () => setMode("library"));
  elements.continueToCustomize.addEventListener("click", () => {
    const hasSelectedJob = window.CampusJobsApp && window.CampusJobsApp.getSelectedJob();
    setMode(hasSelectedJob ? "application" : "jobs");
  });

  elements.profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = core.normalizeLibrary(library);
    next.profile = { ...next.profile, ...getProfileFromForm() };
    saveLibrary(next, "基础档案已保存到当前浏览器。");
  });

  elements.experienceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = experienceFromForm();
    if (!item.title.trim()) {
      setStatus(elements.experienceStatus, "请先填写经历名称。", "error");
      elements.experienceTitle.focus();
      return;
    }
    library = core.upsertExperience(library, item);
    saveLibrary(library);
    resetExperienceForm();
    setStatus(elements.experienceStatus, "经历已保存，可以继续添加下一段。", "success");
  });

  elements.cancelExperienceEdit.addEventListener("click", () => {
    resetExperienceForm();
    setStatus(elements.experienceStatus, "已取消编辑。", "neutral");
  });

  elements.experienceList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exp-action]");
    if (!button) return;
    const item = library.experiences.find((entry) => entry.id === button.dataset.expId);
    if (!item) return;
    if (button.dataset.expAction === "edit") loadExperienceIntoForm(item);
    if (button.dataset.expAction === "delete" && window.confirm(`确认删除“${item.title}”吗？此操作会同步到 APP 简历库。`)) {
      saveLibrary(core.removeExperience(library, item.id));
      setStatus(elements.experienceStatus, "经历已删除。", "neutral");
    }
  });

  elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files && elements.fileInput.files[0];
    if (!file) return;
    handleFile(file).catch((error) => {
      cancelImport();
      setStatus(elements.uploadStatus, error.message || "文件解析失败。", "error");
    });
  });

  elements.confirmImport.addEventListener("click", () => {
    if (!pendingImport) return;
    if (pendingImport.kind === "library") {
      saveLibrary(pendingImport.library, "简历库备份已恢复。");
    } else {
      saveLibrary(core.mergeImport(library, pendingImport.analysis, pendingImport.sourceType), "导入内容已写入简历库。");
    }
    populateProfileForm();
    cancelImport();
  });

  elements.cancelImport.addEventListener("click", cancelImport);
  elements.exportLibrary.addEventListener("click", exportLibrary);
  elements.clearLibrary.addEventListener("click", () => {
    if (!window.confirm("确认清空个人简历库吗？建议先导出 JSON 备份。")) return;
    saveLibrary(core.createEmptyLibrary(), "简历库已清空。");
    populateProfileForm();
    resetExperienceForm();
  });
  elements.loadSample.addEventListener("click", () => {
    const hasData = library.experiences.length || Object.values(library.profile).some(Boolean);
    if (hasData && !window.confirm("示例会替换当前简历库。建议先导出备份，是否继续？")) return;
    saveLibrary(sampleLibrary(), "示例简历库已载入，可以体验岗位定制。 ");
    populateProfileForm();
  });

  populateProfileForm();
  renderLibrary();
  setMode("jobs");
  syncLibraryWithServer();
  window.ResumeLibraryApp = { getLibrary, getKnowledgeBase, setMode };
  window.dispatchEvent(new CustomEvent("resume-library-ready", { detail: { library: getLibrary() } }));
})();
