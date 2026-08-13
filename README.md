# 履析｜个人简历库与岗位定制

履析是一款本地优先的求职工作台，把“岗位信息 → 个人简历库 → 岗位定制”串成完整流程。你可以持续沉淀真实经历，按 STAR 结构管理证据，再针对不同 JD 生成定制简历。

## 在线体验

[打开履析网页版](https://3048138228-web.github.io/luxi-resume-studio/)

网页版的数据只保存在访问者自己的浏览器中；如需跨浏览器读取同一份本机简历库，请使用下方的本地启动方式。

## 核心功能

### 岗位信息

- 导入 UTF-8 编码的 CSV/TSV 岗位文件。
- 自动识别秋招记录、去重并生成数据质量统计。
- 按公司、岗位、地点、职类和届别搜索筛选。
- 查看岗位详情，并把目标岗位带入定制流程。

### 个人简历库

- 管理基础档案、技能、语言和证书。
- 按实习、工作、项目、科研、校园和志愿服务归类经历。
- 分别保存 Situation、Task、Action、Result。
- 本地解析 PDF、DOCX、TXT、Markdown 和 JSON 备份。
- 自动统计完整度、能力标签和经历画像。

### 岗位定制

- 拆解 JD 的职责、要求、加分项和关键词。
- 按相关度选择简历库中的真实经历。
- 生成完整简历、匹配分析、改写建议和表单填写稿。
- 缺少证据时明确标记“待补充”，不编造数据。

## 快速开始

需要 Node.js 18 或更高版本。

```bash
git clone https://github.com/3048138228-web/luxi-resume-studio.git
cd luxi-resume-studio
npm install
npm start
```

然后打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。服务运行期间请保持终端开启。

## 数据与隐私

- 简历数据只保存在本机的 `data/resume-library.json`，该文件已被 Git 忽略。
- 首次启动会根据 `data/resume-library.example.json` 自动创建空白简历库。
- 浏览器 `localStorage` 仅作为缓存，APP 本机服务是统一数据源。
- 上传文件的解析和简历生成均在本机完成，不上传到第三方服务。
- `outputs/`、个人简历库和导入报告默认不会进入版本控制。

## 导入岗位数据

网页支持直接导入 CSV。也可以把岗位数据固化到本地 `data/jobs.js`：

```bash
npm run import:jobs -- "/绝对路径/岗位数据.csv"
```

如果需要校验预期源文件行数：

```bash
npm run import:jobs -- "/绝对路径/岗位数据.csv" --expected 4842
```

## macOS 桌面启动器

```bash
zsh launcher/build-app.sh
```

构建后会在 `~/Applications` 安装“履析简历助手”，并在桌面创建快捷入口。启动器会检查本地服务、打开 Terminal，并在服务就绪后打开网页。

## 测试

```bash
npm test
node --check scripts/server.js
node --check src/library-app.js
node --check src/jobs-app.js
```

## 技术栈

- 原生 HTML、CSS、JavaScript
- Node.js 本地 HTTP 服务
- PDF.js 与 Mammoth.js 本地文件解析
- 无数据库、无云端依赖

## License

[MIT](LICENSE)
