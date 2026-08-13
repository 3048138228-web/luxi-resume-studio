#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const core = require("../src/jobs-core");

function parseArgs(argv) {
  const args = { input: "", output: "data/jobs.js", report: "data/jobs-import-report.json", expected: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--") && !args.input) {
      args.input = value;
      continue;
    }
    const key = value.slice(2);
    if (["output", "report", "expected", "source-url", "source-name", "source-view"].includes(key)) {
      args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[index + 1] || "";
      index += 1;
    } else {
      throw new Error(`未知参数：${value}`);
    }
  }
  args.expected = Number(args.expected || 0);
  if (!args.input) throw new Error("请提供飞书导出的 CSV/TSV 文件路径。");
  if (args.expected && (!Number.isInteger(args.expected) || args.expected < 1)) throw new Error("--expected 必须是正整数。");
  return args;
}

function countBy(items, key) {
  return Object.fromEntries(
    Array.from(items.reduce((counts, item) => {
      const value = item[key] || "未填写";
      counts.set(value, (counts.get(value) || 0) + 1);
      return counts;
    }, new Map()).entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
  );
}

function buildReport(result, inputPath, generatedAt) {
  const jobs = result.jobs;
  return {
    generatedAt,
    sourceFile: path.basename(inputPath),
    sourceRows: result.sourceCount,
    autumnRows: result.autumnCount,
    importedJobs: jobs.length,
    excludedNonAutumn: result.excludedCount,
    invalidRows: result.invalidCount,
    duplicateRows: result.duplicateCount,
    uniqueCompanies: new Set(jobs.map((job) => job.company).filter(Boolean)).size,
    missingFields: {
      company: jobs.filter((job) => !job.company).length,
      role: jobs.filter((job) => !job.role).length,
      location: jobs.filter((job) => !job.location).length,
      recruitmentType: jobs.filter((job) => !job.recruitmentType).length,
      applyUrl: jobs.filter((job) => !job.applyUrl).length,
      jobDescription: jobs.filter((job) => !job.description && !job.requirements && !job.rawText).length
    },
    recruitmentTypes: countBy(jobs, "recruitmentType"),
    categories: countBy(jobs, "category"),
    locations: countBy(jobs, "location")
  };
}

function buildDataset(result, args, generatedAt) {
  return {
    meta: {
      sourceName: args.sourceName || "导入的秋招岗位",
      sourceView: args.sourceView || "秋招岗位",
      sourceUrl: args.sourceUrl || "",
      sourceFile: path.basename(args.input),
      syncedAt: generatedAt,
      sourceRowCount: result.sourceCount,
      recordCount: result.jobs.length,
      status: "synced"
    },
    jobs: result.jobs
  };
}

function importFile(args) {
  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) throw new Error(`找不到文件：${inputPath}`);
  const extension = path.extname(inputPath).toLowerCase();
  if (![".csv", ".tsv", ".txt"].includes(extension)) throw new Error("当前命令支持 CSV、TSV 或 TXT；请从飞书导出为 CSV。 ");
  const delimiter = extension === ".tsv" ? "\t" : undefined;
  const result = core.importAutumnJobs(fs.readFileSync(inputPath, "utf8"), delimiter);
  if (!result.sourceCount) throw new Error("文件中没有可识别的数据行。");
  if (args.expected && result.sourceCount !== args.expected) {
    throw new Error(`源文件行数为 ${result.sourceCount}，与预期 ${args.expected} 不一致；未写入岗位库。`);
  }
  if (!result.jobs.length) throw new Error("没有识别到可导入的秋招记录；未写入岗位库。");

  const generatedAt = new Date().toISOString();
  const dataset = buildDataset(result, args, generatedAt);
  const report = buildReport(result, inputPath, generatedAt);
  const outputPath = path.resolve(args.output);
  const reportPath = path.resolve(args.report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(outputPath, `window.CampusJobsData = ${JSON.stringify(dataset, null, 2)};\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { dataset, report, outputPath, reportPath };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = importFile(args);
    process.stdout.write([
      `岗位数据：${result.outputPath}`,
      `质量报告：${result.reportPath}`,
      `源文件 ${result.report.sourceRows} 行；秋招 ${result.report.autumnRows} 行；导入 ${result.report.importedJobs} 条；企业 ${result.report.uniqueCompanies} 家。`
    ].join("\n") + "\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { parseArgs, countBy, buildReport, buildDataset, importFile };
