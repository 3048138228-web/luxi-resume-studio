const assert = require("assert");
const jobsCore = require("../src/jobs-core");
const jobsImporter = require("../scripts/import-jobs");

const jobs = jobsCore.normalizeJobs([
  {
    公司: "星河科技",
    岗位名称: "用户运营管培生",
    工作地点: "上海",
    岗位类别: "运营",
    届别: "2027届",
    岗位职责: "负责用户增长活动和社群运营。",
    任职要求: "熟练使用 Excel，具备数据复盘能力。",
    投递链接: "https://example.com/apply"
  },
  {
    company: "远山数据",
    role: "数据分析师",
    location: "北京",
    category: "数据",
    cohort: "2027届",
    description: "搭建指标体系并完成专题分析。",
    requirements: "熟悉 SQL 和 Python。"
  }
]);

assert.strictEqual(jobs.length, 2);
assert.strictEqual(jobs[0].company, "星河科技");
assert.strictEqual(jobs[0].role, "用户运营管培生");
assert.ok(jobsCore.buildJd(jobs[0]).includes("任职要求："));
assert.strictEqual(jobsCore.filterJobs(jobs, { query: "SQL" }).length, 1);
assert.strictEqual(jobsCore.filterJobs(jobs, { location: "上海" }).length, 1);
assert.deepStrictEqual(jobsCore.facets(jobs).cohorts, ["2027届"]);
assert.strictEqual(jobsCore.toApplicationPayload(jobs[1]).company, "远山数据");

const imported = jobsCore.importAutumnJobs('\uFEFF公司,公司行业,招聘类型,工作地点,开始时间,截止日期,岗位职责\n"星河,科技",互联网,秋招提前批,上海,2026/07/21,8.23,"负责增长,并完成复盘"\n远山数据,科技,春招,北京,2026/02/01,招满为止,数据分析\n云帆半导体,半导体,秋招,苏州,2026/07/20,8.5,"芯片测试\n与验证"');
assert.strictEqual(imported.sourceCount, 3);
assert.strictEqual(imported.autumnCount, 2);
assert.strictEqual(imported.excludedCount, 1);
assert.strictEqual(imported.invalidCount, 0);
assert.strictEqual(imported.duplicateCount, 0);
assert.strictEqual(imported.jobs.length, 2);
assert.strictEqual(imported.jobs[0].company, "星河,科技");
assert.strictEqual(imported.jobs[0].category, "互联网");
assert.strictEqual(imported.jobs[0].publishDate, "2026/07/21");
assert.ok(imported.jobs[1].description.includes("与验证"));

const report = jobsImporter.buildReport(imported, "/tmp/jobs.csv", "2026-07-23T00:00:00.000Z");
assert.strictEqual(report.sourceRows, 3);
assert.strictEqual(report.importedJobs, 2);
assert.strictEqual(report.uniqueCompanies, 2);
assert.strictEqual(report.missingFields.role, 2);
assert.deepStrictEqual(report.recruitmentTypes, { "秋招提前批": 1, "秋招": 1 });

const args = jobsImporter.parseArgs(["source.csv", "--expected", "4842", "--output", "tmp/jobs.js"]);
assert.strictEqual(args.input, "source.csv");
assert.strictEqual(args.expected, 4842);
assert.strictEqual(args.output, "tmp/jobs.js");

console.log("jobs tests passed");
