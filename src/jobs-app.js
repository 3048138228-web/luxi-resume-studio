(function bootCampusJobs() {
  "use strict";

  const core = window.CampusJobs;
  const dataset = window.CampusJobsData || { meta: {}, jobs: [] };
  const STORAGE_KEY = "luxi.selected-job.v1";
  const IMPORT_STORAGE_KEY = "luxi.campus-jobs.v1";
  const IMPORT_META_KEY = "luxi.campus-jobs-meta.v1";
  const PAGE_SIZE = 50;
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    search: $("#jobSearchInput"),
    category: $("#jobCategoryFilter"),
    location: $("#jobLocationFilter"),
    cohort: $("#jobCohortFilter"),
    resultCount: $("#jobResultCount"),
    jobList: $("#jobList"),
    pagination: $("#jobPagination"),
    pageText: $("#jobPageText"),
    previousPage: $("#jobPrevPageBtn"),
    nextPage: $("#jobNextPageBtn"),
    jobDetail: $("#jobDetail"),
    total: $("#jobTotalCount"),
    companyCount: $("#jobCompanyCount"),
    locationCount: $("#jobLocationCount"),
    syncedAt: $("#jobSyncedAt"),
    navCount: $("#jobsNavCount"),
    sourceLink: $("#jobSourceLink"),
    fileInput: $("#jobFileInput"),
    importStatus: $("#jobImportStatus"),
    clearData: $("#clearJobDataBtn"),
    choose: $("#chooseJobBtn"),
    libraryBanner: $("#librarySelectedJobBanner"),
    libraryBannerTitle: $("#librarySelectedJobTitle"),
    libraryBannerMeta: $("#librarySelectedJobMeta")
  };

  let jobs = core.normalizeJobs([...(dataset.jobs || []), ...loadImportedJobs()]);
  let importMeta = loadImportMeta();
  let activeJobId = restoreSelectedId();
  let currentPage = 1;

  function loadImportedJobs() {
    try {
      return JSON.parse(localStorage.getItem(IMPORT_STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function loadImportMeta() {
    try {
      return JSON.parse(localStorage.getItem(IMPORT_META_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function restoreSelectedId() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function selectedJob() {
    return jobs.find((job) => job.id === activeJobId) || null;
  }

  function saveSelectedId(id) {
    activeJobId = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (error) {
      // Selection still works for this session when storage is unavailable.
    }
  }

  function options(items, placeholder) {
    return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  }

  function metaItems(job) {
    return [job.location, job.category, job.cohort, job.recruitmentType].filter(Boolean);
  }

  function displayRole(job) {
    return job.role || `${job.recruitmentType || "校招"}招聘信息`;
  }

  function renderJobCard(job) {
    const selected = job.id === activeJobId;
    return `
      <article class="job-card ${selected ? "selected" : ""}">
        <header><div><span>${escapeHtml(job.company || "公司待补充")}</span><h3>${escapeHtml(displayRole(job))}</h3></div><em>${escapeHtml(job.status)}</em></header>
        <div class="job-card-tags">${metaItems(job).map((item) => `<span>${escapeHtml(item)}</span>`).join("") || "<span>信息待补充</span>"}</div>
        <p>${escapeHtml(job.description || job.requirements || job.rawText || "岗位详情待补充")}</p>
        <footer><span>${escapeHtml(job.deadline ? `截止 ${job.deadline}` : job.publishDate || "时间待补充")}</span><button type="button" class="inline-copy" data-job-action="view" data-job-id="${escapeHtml(job.id)}">查看岗位</button></footer>
      </article>
    `;
  }

  function renderEmptyJobs() {
    const sourceUrl = dataset.meta.sourceUrl || "#";
    elements.jobList.innerHTML = `
      <div class="jobs-empty">
        <span>↻</span>
        <h3>等待导入秋招岗位</h3>
        <p>飞书源表当前是外部只读视图，未开放整表复制或下载。请让表格所有者开放权限，再将当前视图导出为 CSV 并从上方导入。</p>
        <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">打开飞书岗位表</a>
      </div>
    `;
    elements.jobDetail.innerHTML = '<div class="job-detail-empty"><span>01</span><h3>先选择一个岗位</h3><p>岗位详情、要求和投递入口会显示在这里。</p></div>';
    elements.choose.disabled = true;
  }

  function renderDetail(job) {
    if (!job) {
      renderEmptyJobs();
      return;
    }
    const jdSections = [
      ["岗位职责", job.description],
      ["任职要求", job.requirements],
      ["加分项", job.bonus],
      ["补充信息", job.rawText]
    ].filter(([, value]) => value);
    elements.jobDetail.innerHTML = `
      <div class="job-detail-heading"><span class="eyebrow">SELECTED JOB</span><h2>${escapeHtml(displayRole(job))}</h2><p>${escapeHtml(job.company || "公司待补充")}</p></div>
      <div class="job-detail-meta">${metaItems(job).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      <dl class="job-facts">
        <div><dt>发布时间</dt><dd>${escapeHtml(job.publishDate || "待补充")}</dd></div>
        <div><dt>截止时间</dt><dd>${escapeHtml(job.deadline || "待补充")}</dd></div>
      </dl>
      <div class="job-description-sections">${jdSections.length ? jdSections.map(([title, value]) => `<section><h3>${escapeHtml(title)}</h3><p>${escapeHtml(value)}</p></section>`).join("") : '<div class="mini-empty">这条记录还没有可展示的 JD 文字。</div>'}</div>
      ${job.applyUrl ? `<a class="job-apply-link" href="${escapeHtml(job.applyUrl)}" target="_blank" rel="noreferrer">打开官方投递页面 ↗</a>` : ""}
    `;
    elements.choose.disabled = false;
    elements.choose.dataset.jobId = job.id;
  }

  function currentFilters() {
    return {
      query: elements.search.value,
      category: elements.category.value,
      location: elements.location.value,
      cohort: elements.cohort.value
    };
  }

  function renderJobs() {
    const filtered = core.filterJobs(jobs, currentFilters());
    elements.resultCount.textContent = `${filtered.length} 个岗位`;
    if (!jobs.length) {
      elements.pagination.hidden = true;
      renderEmptyJobs();
      return;
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageJobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    elements.jobList.innerHTML = filtered.length
      ? pageJobs.map(renderJobCard).join("")
      : '<div class="jobs-empty compact"><span>⌕</span><h3>没有匹配岗位</h3><p>调整关键词或筛选条件后再试。</p></div>';
    elements.pagination.hidden = filtered.length <= PAGE_SIZE;
    elements.pageText.textContent = `第 ${currentPage} / ${totalPages} 页`;
    elements.previousPage.disabled = currentPage <= 1;
    elements.nextPage.disabled = currentPage >= totalPages;
    const detailJob = selectedJob() || pageJobs[0] || filtered[0] || jobs[0];
    renderDetail(detailJob);
  }

  function renderFacets() {
    const selected = {
      category: elements.category.value,
      location: elements.location.value,
      cohort: elements.cohort.value
    };
    const jobFacets = core.facets(jobs);
    elements.category.innerHTML = options(jobFacets.categories, "全部职类");
    elements.location.innerHTML = options(jobFacets.locations, "全部地点");
    elements.cohort.innerHTML = options(jobFacets.cohorts, "全部届别");
    elements.category.value = selected.category;
    elements.location.value = selected.location;
    elements.cohort.value = selected.cohort;
    return jobFacets;
  }

  function renderStats() {
    const jobFacets = renderFacets();
    elements.total.textContent = String(jobs.length);
    elements.navCount.textContent = jobs.length ? `${jobs.length} 个岗位` : "等待导入";
    elements.companyCount.textContent = String(new Set(jobs.map((job) => job.company).filter(Boolean)).size);
    elements.locationCount.textContent = String(jobFacets.locations.length);
    const syncedAt = importMeta && importMeta.importedAt ? new Date(importMeta.importedAt).toLocaleString("zh-CN") : dataset.meta.syncedAt;
    elements.syncedAt.textContent = syncedAt ? `更新于 ${syncedAt}` : "等待导入飞书 CSV";
    elements.clearData.hidden = !importMeta;
  }

  function setImportStatus(message, state) {
    elements.importStatus.textContent = message;
    elements.importStatus.dataset.state = state || "neutral";
  }

  async function importJobFile(file) {
    if (!file) return;
    setImportStatus(`正在读取 ${file.name}……`, "neutral");
    try {
      const result = core.importAutumnJobs(await file.text(), file.name.toLowerCase().endsWith(".tsv") ? "\t" : undefined);
      if (!result.jobs.length) throw new Error("没有识别到可导入的秋招记录，请确认文件包含表头和数据。");
      importMeta = { fileName: file.name, importedAt: new Date().toISOString(), sourceCount: result.sourceCount };
      jobs = result.jobs;
      let persisted = true;
      try {
        localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(jobs));
        localStorage.setItem(IMPORT_META_KEY, JSON.stringify(importMeta));
      } catch (error) {
        persisted = false;
      }
      activeJobId = jobs.some((job) => job.id === activeJobId) ? activeJobId : "";
      currentPage = 1;
      renderStats();
      renderJobs();
      const filteredText = result.excludedCount ? `，已排除 ${result.excludedCount} 条非秋招记录` : "";
      const skippedCount = result.invalidCount + result.duplicateCount;
      const skippedText = skippedCount ? `，另跳过 ${skippedCount} 条空白或重复记录` : "";
      setImportStatus(`已导入 ${jobs.length} 条秋招记录${filteredText}${skippedText}${persisted ? "，并保存在本机" : "；浏览器空间不足，本次仅在当前页面有效"}。`, persisted ? "success" : "error");
    } catch (error) {
      setImportStatus(error.message || "导入失败，请改用 UTF-8 编码的 CSV。", "error");
    } finally {
      elements.fileInput.value = "";
    }
  }

  function clearImportedJobs() {
    if (!window.confirm("确定清除本机导入的岗位数据吗？个人简历库不会受到影响。")) return;
    try {
      localStorage.removeItem(IMPORT_STORAGE_KEY);
      localStorage.removeItem(IMPORT_META_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Continue clearing the current session even when storage is unavailable.
    }
    importMeta = null;
    jobs = core.normalizeJobs(dataset.jobs || []);
    activeJobId = "";
    currentPage = 1;
    renderStats();
    renderJobs();
    renderLibraryBanner(null);
    setImportStatus("已清除导入的岗位数据。", "neutral");
  }

  function renderLibraryBanner(job) {
    if (!elements.libraryBanner) return;
    elements.libraryBanner.hidden = !job;
    if (!job) return;
    elements.libraryBannerTitle.textContent = `${job.company || "公司待补充"} · ${job.role || "岗位待补充"}`;
    elements.libraryBannerMeta.textContent = `${metaItems(job).join(" · ") || "岗位信息已选择"}。检查简历库后继续生成定制版本。`;
  }

  function selectJob(id, continueToLibrary) {
    const job = jobs.find((item) => item.id === id);
    if (!job) return;
    saveSelectedId(job.id);
    renderJobs();
    renderLibraryBanner(job);
    window.dispatchEvent(new CustomEvent("campus-job-selected", { detail: { job, payload: core.toApplicationPayload(job) } }));
    if (continueToLibrary && window.ResumeLibraryApp) window.ResumeLibraryApp.setMode("library");
  }

  renderStats();
  elements.sourceLink.href = dataset.meta.sourceUrl || "#";
  if (importMeta && importMeta.fileName) setImportStatus(`本机已载入 ${jobs.length} 条记录，来源：${importMeta.fileName}。`, "success");

  [elements.search, elements.category, elements.location, elements.cohort].forEach((element) => {
    element.addEventListener("input", () => { currentPage = 1; renderJobs(); });
    element.addEventListener("change", () => { currentPage = 1; renderJobs(); });
  });

  elements.jobList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-job-action='view']");
    if (!button) return;
    selectJob(button.dataset.jobId, false);
  });

  elements.choose.addEventListener("click", () => selectJob(elements.choose.dataset.jobId, true));
  elements.fileInput.addEventListener("change", () => importJobFile(elements.fileInput.files[0]));
  elements.clearData.addEventListener("click", clearImportedJobs);
  elements.previousPage.addEventListener("click", () => { currentPage -= 1; renderJobs(); elements.jobList.scrollIntoView({ behavior: "smooth", block: "start" }); });
  elements.nextPage.addEventListener("click", () => { currentPage += 1; renderJobs(); elements.jobList.scrollIntoView({ behavior: "smooth", block: "start" }); });

  renderJobs();
  renderLibraryBanner(selectedJob());
  window.CampusJobsApp = {
    getJobs: () => jobs.map((job) => ({ ...job })),
    getSelectedJob: () => {
      const job = selectedJob();
      return job ? { ...job } : null;
    },
    selectJob: (id) => selectJob(id, false)
  };
})();
