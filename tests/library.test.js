const assert = require("assert");
const libraryCore = require("../src/library-core");

const imported = libraryCore.analyzeImportedResume([
  "姓名：王小明",
  "邮箱：xiaoming@example.com",
  "最高学历：本科",
  "最高学历毕业院校：某大学",
  "专业：市场营销",
  "技能：Excel、SQL、公众号运营",
  "用户运营实习：负责社群内容排期与数据复盘。",
  "校园项目：策划校园活动并协调志愿者。"
].join("\n"), "王小明简历.txt");

assert.strictEqual(imported.profilePatch.name, "王小明");
assert.strictEqual(imported.profilePatch.email, "xiaoming@example.com");
assert.ok(imported.experiences.some((item) => item.title === "用户运营实习"));

let library = libraryCore.mergeImport(libraryCore.createEmptyLibrary(), imported, "text");
assert.strictEqual(library.profile.name, "王小明");
assert.strictEqual(library.sources.length, 1);
assert.ok(library.experiences.length >= 2);

const first = library.experiences[0];
library = libraryCore.upsertExperience(library, {
  ...first,
  situation: "新用户留存偏低",
  task: "提升社群活跃度",
  action: "设计分层内容排期并每周复盘",
  result: "社群周活跃率提升 18%"
});

const generated = libraryCore.generateStarResume({
  company: "星河科技",
  role: "用户运营",
  jdText: "岗位职责：负责用户运营、社群增长和数据复盘。任职要求：熟练使用 Excel。"
}, library);

assert.ok(generated.markdown.includes("# 王小明｜用户运营"));
assert.ok(generated.markdown.includes("社群周活跃率提升 18%"));
assert.ok(generated.experiences[0].bullet.includes("设计分层内容排期并每周复盘"));
assert.ok(generated.experiences[0].bullet.startsWith("针对新用户留存偏低，提升社群活跃度；"));
assert.ok(generated.skills.includes("公众号运营"));
assert.ok(!generated.skills.includes("运营"));
assert.strictEqual(generated.meta.sourceExperienceCount, library.experiences.length);
assert.ok(libraryCore.buildKnowledgeBase(library).includes("# 经历库"));
assert.ok(libraryCore.profileCompleteness(library).percent > 0);

const removed = libraryCore.removeExperience(library, first.id);
assert.strictEqual(removed.experiences.length, library.experiences.length - 1);

console.log("library tests passed");
