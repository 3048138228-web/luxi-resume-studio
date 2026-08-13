const assert = require("assert");
const assistant = require("../src/assistant-core");

const result = assistant.analyzeApplication({
  company: "星河科技",
  role: "用户运营实习生",
  jdText: [
    "岗位职责：负责用户增长活动的数据整理、复盘和优化建议。",
    "协助运营公众号、社群和活动页面，提升用户转化与留存。",
    "任职要求：熟练使用 Excel，有数据分析、内容运营或活动策划经验。",
    "有 SQL、Python、公众号运营经验优先。"
  ].join("\n"),
  resumeText: [
    "姓名：张三",
    "电话：13800138000",
    "邮箱：zhangsan@example.com",
    "某大学 本科 新闻传播学 2026届",
    "新媒体运营实习：负责公众号选题、推文撰写与数据复盘，协助完成活动宣传。",
    "校园活动项目：策划校园安全法治活动，协调志愿者、物料和宣传排期。",
    "技能：Excel、公众号排版、文案写作、基础 SQL。"
  ].join("\n"),
  formText: ["自我评价", "相关实习经历", "项目经历", "期望薪资", "是否接受调剂"].join("\n")
});

assert.ok(result.markdown.includes("## 1. 岗位画像"));
assert.ok(result.markdown.includes("## 2. 匹配分析"));
assert.ok(result.markdown.includes("## 3. 定制简历版本"));
assert.ok(result.markdown.includes("## 4. 表单填写稿"));
assert.ok(result.markdown.includes("## 5. 风险提示"));
assert.ok(result.meta.fieldCount === 5);
assert.ok(result.formAnswers.some((item) => item.label === "自我评价" && item.answer.includes("公众号")));
assert.ok(result.formAnswers.some((item) => item.label === "期望薪资" && item.answer.includes("待确认")));
assert.ok(result.formAnswers.every((item) => item.reason && item.confirmation && item.status));
assert.ok(result.risks.some((item) => item.includes("不要自动提交")));

const availabilityField = assistant.analyzeApplication({
  role: "用户运营实习生",
  jdText: "岗位职责：负责社群运营。",
  resumeText: "社群运营实习：负责社群内容排期。",
  formText: "每周可实习天数"
}).formAnswers[0];

assert.strictEqual(availabilityField.type, "availability");
assert.ok(availabilityField.answer.includes("待确认"));
assert.ok(!availabilityField.answer.includes("社群内容排期"));

const fallback = assistant.analyzeApplication({
  jdText: "任职要求：熟练使用 Python 和机器学习。",
  resumeText: "姓名：李四\n邮箱：lisi@example.com",
  formText: "项目经历"
});

assert.ok(fallback.formAnswers[0].answer.includes("待确认"));
assert.ok(fallback.risks.some((item) => item.includes("缺少")));

const strictUnknowns = assistant.analyzeApplication({
  role: "商务管理培训生",
  jdText: "第一阶段：商务支持。要求具备市场调研、跨部门沟通和商务分析能力。",
  resumeText: "核心课程：国际营销、进出口实务。\n行业研究实习：独立撰写海外光伏行业报告。",
  formText: ["职位", "性别", "出生日期", "最近看了什么有趣的书？请描述推荐理由"].join("\n")
});

assert.strictEqual(strictUnknowns.formAnswers.find((item) => item.label === "职位").answer, "商务管理培训生");
assert.ok(strictUnknowns.formAnswers.find((item) => item.label === "性别").answer.includes("待确认"));
assert.ok(strictUnknowns.formAnswers.find((item) => item.label === "出生日期").answer.includes("待确认"));
assert.ok(strictUnknowns.formAnswers.find((item) => item.label.includes("最近看了什么")).answer.includes("开放题"));
assert.ok(!strictUnknowns.formAnswers.find((item) => item.label === "性别").answer.includes("行业研究"));

const knowledgeBase = assistant.analyzeApplication({
  role: "商务管理培训生",
  jdText: "岗位职责：商务支持、市场调研、项目协同。",
  resumeText: [
    "# 基础信息",
    "- 姓名：王五",
    "- 性别：女",
    "- 出生日期：2003.02",
    "# 教育经历",
    "- 最高学历：本科",
    "- 最高学历毕业院校：对外经济贸易大学",
    "- 专业：商务英语；双学位：金融学",
    "- 专业成绩排名：前 15%"
  ].join("\n"),
  formText: ["姓名", "性别", "出生日期", "最高学历", "最高学历毕业院校", "专业", "专业成绩排名"].join("\n")
});

assert.strictEqual(knowledgeBase.formAnswers.find((item) => item.label === "姓名").answer, "王五");
assert.strictEqual(knowledgeBase.formAnswers.find((item) => item.label === "性别").answer, "女");
assert.strictEqual(knowledgeBase.formAnswers.find((item) => item.label === "最高学历").answer, "本科");
assert.strictEqual(knowledgeBase.formAnswers.find((item) => item.label === "最高学历毕业院校").answer, "对外经济贸易大学");
assert.strictEqual(knowledgeBase.formAnswers.find((item) => item.label === "专业成绩排名").answer, "前 15%");

const sectionedJd = assistant.extractJobSignals([
  "岗位职责：",
  "1. 负责用户增长活动的数据整理与复盘。",
  "2. 跟进跨部门沟通，推进活动上线。",
  "任职要求：",
  "1. 熟练使用 Excel，有内容运营经验。",
  "2. 具备沟通协调能力。",
  "加分项：",
  "1. 有 SQL 经验优先。"
].join("\n"), "星河科技", "用户运营实习生");

assert.deepStrictEqual(sectionedJd.responsibilities, [
  "负责用户增长活动的数据整理与复盘。",
  "跟进跨部门沟通，推进活动上线。"
]);
assert.deepStrictEqual(sectionedJd.requirements, [
  "熟练使用 Excel，有内容运营经验。",
  "具备沟通协调能力。"
]);
assert.deepStrictEqual(sectionedJd.bonus, ["有 SQL 经验优先。"]);
assert.ok(assistant.analyzeApplication({
  company: "星河科技",
  role: "用户运营实习生",
  jdText: ["岗位职责：负责用户运营。", "任职要求：熟练使用 Excel。", "加分项：有 SQL 经验优先。"].join("\n"),
  resumeText: "用户运营实习：负责社群维护。",
  formText: "自我评价"
}).profile.bullets.some((item) => item.startsWith("加分项：")));

const noFalseAiMatch = assistant.analyzeApplication({
  jdText: "岗位要求：需要 AI 自动化能力。",
  resumeText: "姓名：李四\n邮箱：lisi@mail.com",
  formText: "自我评价"
});

assert.ok(!noFalseAiMatch.match.bullets[0].includes("关键词重合：AI"));
assert.strictEqual(noFalseAiMatch.meta.matchedCount, 0);

console.log("analyzer tests passed");
