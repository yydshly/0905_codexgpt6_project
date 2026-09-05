# 多工程与保存版本 · 实测记录

2026-09-05；基线 `ffc03aa`；实现提交 `a4296c2`；独立分支 `codex/project-library`。

## 环境与入口

Windows 11 Home Chinese 26200，Node 22.15.0、Playwright 1.62.1、安装的 Chrome 152.0.7977.82 headless、DPR 1。实际 GPU 为 Intel UHD / ANGLE D3D11。运行测试使用隔离浏览器上下文，没有替换用户浏览器里的方案。

- 开发入口：`npm run dev`，http://127.0.0.1:5173/?workspace=projects 。
- 生产回归：`npm run build` / `npm run preview`，4173。
- 仓库子路径：`npm run build:pages` / `npm run preview:pages`，4174/0905_codexgpt6_project/。
- 两个实际 ZIP 分别在独立 HTTP 服务器路径 `/a/`、`/b/` 打开，禁止读取作者 localStorage 和 IndexedDB，仍完整运行。

## 实际操作证据

| 操作与状态 | 结果 |
| --- | --- |
| 原书房和短片迁入；重开；快速工作区再次保存 | pass；原 localStorage 字节不变，相同内容去重，新保存独立迁入 |
| 创建 A，关联作品、改桌面材质、修改第二镜头、设置个人名称 | pass；房间/短片/作品路由保持同一个 ID |
| A 另存为 B，独立修改作品、深夜氛围和镜头时长 | pass；A 的完整保存数据不变 |
| 新建未完成的 C，复制 A 为独立副本 | pass；四张真实缩略图，副本从版本 1 开始 |
| 搜索、刷新和各工程继续编辑 | pass；返回正确内容，名称和配置互不混用 |
| 恢复 A 版本 1，再恢复到修改完成的版本 | pass；每次恢复追加版本，原版本数量持续保留，最终与恢复目标逐字段一致 |
| 重复保存未改动内容 | pass；不增加相同内容的版本 |
| 两个标签页同时修改同一工程 | pass；第二次保存收到冲突提示，已保存版本未覆盖；当前修改可另存为副本 |
| 无效 JSON、数据库被禁用、真实事务中止 | pass；显示错误，当前项目和快照一起回滚，编辑器修改仍保留 |
| 注入配额错误并中止真实数据库事务 | pass；显示空间不足，原数据/版本号不变。这不是实际填满用户硬盘的测试 |
| 无 WebGL、减少动态、390px 管理 | pass；预览不可用时仍能导入、复制、搜索，数据操作不依赖缩略图 |
| 键盘打开、输入、Escape 和焦点返回 | pass；新建弹窗焦点正确，可见焦点轮廓 |
| A/B 分别导出网站 ZIP，独立打开并点击作品 | pass；两个文件的数据、氛围、作品与镜头时长分别正确，不包含工程库操作按钮 |
| 当前工程 JSON 下载后重新导入为第五套工程 | pass；JSON 逐字段一致，导入不替换其他工程 |
| 原编辑、历史、灯光、模型、PNG、视频和作品发布回归 | pass；完整 34 项单次通过，包含实际视频文件下载与原生回放 |

新增四项初次运行有两个验收脚本错误：旧版固定墙画迁移为可编辑相框的预期遗漏，以及测试使用了不存在的 `lamp-1`，实际 ID 为 `taskLamp-1`。修正预期和选择器后四项通过（29.5 秒）；随后完整 **34 项全部通过（202.5 秒，无重试/跳过）**。补充配额/无 WebGL/性能测试 **1 项通过（8.5 秒）**。最终 **Pages 子路径全部 5 项通过（37.6 秒，含构建启动）**，没有把分批结果称为单次 35/35。

TypeScript、生产构建、Pages 构建、`npm audit --audit-level=high` 通过，audit 0 漏洞。Three.js 大包构建提示仍保留，没有通过调高阈值隐藏它。

GitHub 新增 projects 套件，与其他五个套件一同运行。[本轮云端记录](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33959620002)，交付时状态见 [acceptance.json](projects-evidence/acceptance.json)，未完成的云端任务不计通过。

## 真实截图与导出文件

六张截图均来自实际浏览器：

- [工程库 1440×900](projects-evidence/01-library-1440x900.png)
- [版本恢复确认 1280×800](projects-evidence/02-history-restore-1280x800.png)
- [灯具编辑与工程入口 1280×800](projects-evidence/03-editor-1280x800.png)
- [窄屏工程库 390×844](projects-evidence/04-library-mobile-390x844.png)（最终 Pages 复验）
- [B 工程的作品预览与详情](projects-evidence/05-project-b-visitor-preview.png)
- [实际导出的 B 网站独立运行](projects-evidence/06-exported-b-independent-1440x900.png)

[A 网站 ZIP](projects-evidence/project-a-site.zip) 为白昼、摄影作品、第二镜头 4.4 秒；[B 网站 ZIP](projects-evidence/project-b-site.zip) 为深夜、独立产品、第二镜头 2.8 秒。[A 完整可编辑工程](projects-evidence/project-a.json) 可导入工程库。导出文件不含其他项目或历史版本，访客实点的原始记录在 [independent-sites.json](projects-evidence/independent-sites.json)。

## 测量与边界

已有一套工程与缓存缩略图时，本机重新打开工程库到 ready 74 ms、缩略图可见 83 ms。该测量为本机缓存场景，不是冷启动、公网或大量工程性能保证。独立 A/B 站到 ready 分别 1858 / 428 ms（运行文件共享浏览器缓存）；实际场景 94,942 三角形、canvas 1200×657。没有把 CPU 提交耗时写成 FPS。

原短片回归生成 H.264、1280×720、10.2 秒、6,237,870 字节视频并重新打开回放；三个时间点与预览平均像素差约 1.18 / 1.70 / 1.71，实际相机匹配共享采样器。记录在 [film-regression.json](projects-evidence/film-regression.json)，本轮未重复提交原功能视频二进制。

范围内验收未留下已知阻断问题。保存版本是本地快照，不是云端历史；JSON 备份仅含当前版本，不含整个版本库。浏览器清除/回收网站存储会影响数据；未实现删除、回收站、整库备份或跨设备同步。Safari/Firefox、真实手机 GPU、数百工程/大版本库负载以及公网部署未实测。详细使用与存储说明见 [PROJECTS.md](PROJECTS.md)。
