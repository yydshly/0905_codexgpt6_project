# 通用关联与个人网站 · 验收记录

2026-09-05，基线 `df582ac`，实现提交 `ad30c93`，分支 `codex/publishable-portfolio`。增量保留布置、短片、保存和导出。当前未替换公网 GitHub Pages 编辑器。

## 真实环境与命令

- Windows 11 Home Chinese 26200；Node 22.15.0，Playwright 1.62.1，Chrome 152.0.7977.82 headless，DPR 1。
- GPU 实际报告 Intel UHD / ANGLE D3D11；没有以其他显卡型号代替实际设备。
- `npm run dev`：127.0.0.1:5173。`npm run build && npm run preview`：4173。Pages 构建验收：4174/0905_codexgpt6_project/。
- 发布 ZIP 解压到独立 HTTP 服务器，在全新浏览器上下文测试；主动令 Storage.getItem 抛错，验证访客不依赖作者存档。保留的独立本机预览在 http://127.0.0.1:4180/，其文件直接来自交付 ZIP。
- 测试使用隔离浏览器，不修改用户正在使用的浏览器存档。

## 操作与结果

| 流程 | 结果与证据 |
| --- | --- |
| 11 类物件逐一从属性面板关联作品 | pass，catalog.json；共 13 个目标含书桌/显示器双入口 |
| 各类隔离物件在真实房间中，隐藏 DOM 标记后点几何 | pass，actual-geometry.json；11 类全部实点，桌面物件保留必需父书桌 |
| 书桌整体与桌面书籍关联不同项目 | pass，实际点击分别弹出正确详情，具体部位优先 |
| 相框关联、删除、撤销重做、保存刷新 | pass，作品配置逐字段一致 |
| 旧 portfolio v1 的 JSON 迁移 | pass，绑定和物件不变，升级 v2 默认介绍 |
| 个人名称/标题/简介 → 保存设置 → 刷新 | pass，恢复同一介绍 |
| 发布模板请求故意返回 503 → 重试下载 | pass，失败提示，无假下载成功，恢复后取得 ZIP |
| 解压实际 ZIP → 新服务器仓库式子路径打开 | pass，工程与随包 JSON 逐字段一致 |
| 访客点击物品 → 详情 → 访问产品 | pass，真实新标签页打开对应 GitHub 项目 |
| 未关联草稿排除 | pass，作者保留草稿，发布 JSON 仅含四个已关联作品 |
| 根路径重新打开、无编辑器按钮、全部运行请求来自自身服务器 | pass，无需作者 localStorage / 外部运行依赖 |
| 整屋 GLB 与对应 JSON → 独立适配器点击相框 | pass，读取整体 itemId，不依赖家具建模代码 |
| 宿主 iframe → 点击相框 → 外层页面显示作品 | pass，activateProject 事件正常 |
| 无 WebGL、缺少 project.json、减少动态、键盘详情/Escape/焦点返回 | pass，可用降级或真实错误提示 |
| 1440×900 / 1280×800 / 390×844，白昼/深夜、长介绍、属性面板 | pass，六张运行截图和 final-review.json |

根路径最终新增测试 **4/4，通过 23.6 秒**；Pages 子路径 **4/4，通过 28.8 秒**。原有作品流程早期回归 5/5 通过。

完整 30 项首轮 **27 通过、3 失败**（约 2.7 分钟）。三个失败均暴露新增入口占高导致原属性面板按钮/灯光滑杆越出可用高度：1280×800 下删除按钮底部约 896 px。已将入口压缩为同行操作，较矮窗口隐藏冗余预览图；**三个失败流程全部复验通过**（12.3 秒），断言未放宽。最终测得删除按钮底部约 743 px，亮度滑杆 y=629 px；之后新增四项又完整通过。这里按受影响范围复验，不把首轮写成 30/30 单次通过。

`npm run build`、`build:pages`、TypeScript、`npm audit --audit-level=high` 通过，audit 0 漏洞。Three.js 主包仍有大于 500 kB 的构建提示，未掩盖或调高阈值。

GitHub 已增加独立 publish 套件，与原四个套件共 30 项。[首轮云端运行](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33957682972) 中 publish、portfolio、room-reuse、film-controls 通过，film-export 暂停步骤失败。实际 trace 显示播放期间定位按钮花费约 6.26 秒，加上鼠标操作延迟，按下时播放头已到 10.2 秒片尾；随后点击正常开始重播。测试提交 `d169584` 将按钮定位和鼠标移动放在播放前，保留暂停断言，并增加「暂停时间小于总时长」断言，没有修改产品行为。本机再次完成该短片的修改、保存刷新、视频下载和实际回放，**1/1 通过，28.2 秒**。

[修正后的云端运行](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33958022637) 已触发。交付记录时的逐任务状态见 [acceptance.json](publish-evidence/acceptance.json)，尚未结束的任务不计通过。

## 实际交付与性能

- [网站 ZIP](publish-evidence/personal-homepage.zip)：296,726 字节；包含独立 HTML、CSS、JS、JSON、.nojekyll、许可及部署说明，已解压运行。
- [对应 JSON](publish-evidence/published-project.json) 与 [实际 GLB](publish-evidence/personal-room.glb)。JSON 含四个已关联作品与个人介绍；GLB 3,780,580 字节。
- [作者配置 1440](publish-evidence/01-all-object-author-1440x900.png)、[发布设置 1440](publish-evidence/02-publish-1440x900.png)、[访客页 1440](publish-evidence/03-visitor-1440x900.png)、[详情 1280](publish-evidence/04-visitor-detail-1280x800.png)、[手机深夜详情](publish-evidence/05-mobile-night-390x844.png)、[修正后的灯具面板 1280](publish-evidence/06-lamp-panel-1280x800.png)。均是实际运行截图。

独立站本机导航到 ready 425 ms（1440×900），canvas 1200×657。场景几何 94,942 三角形、171 mesh、15 合批；多遍渲染记录 349 calls。首次三个渲染 CPU 提交耗时约 111.4 / 92.4 / 6 ms，包含准备开销，**不等于持续交互 FPS 或 GPU 时间保证**。手机尺寸复验 canvas 390×454。完整原始记录在 [journey.json](publish-evidence/journey.json)。没有进行公网网络或极限入口数量性能测试。

原短片也实际完成修改第二镜头、保存恢复、H.264 导出和原生回放：1280×720、10.2 秒、6,345,949 字节。三个时间点与预览的平均像素差约 1.23 / 1.71 / 1.71，采样器匹配；[本轮视频回归记录](publish-evidence/film-regression.json)。未将视频误称为可点击的 3D 产品，也未重复提交原功能的新视频二进制。

## 已知边界

网站包已经可部署，但本轮没有公开发布个人示例或自动更换原站；未验证公网自定义域名。静态网站更新需要重新下载并部署，不是云同步。作品入口覆盖 11 类可选物件，墙体、窗户及书架每本书不是独立目标。手机个人介绍显示有所收敛，作品详情可完整阅读。

Safari / Firefox、真实手机 GPU、跨域 iframe、原生 WebView、其他 3D 引擎，以及 40 物件/80 入口极限负载未实测。它们没有计为通过。详细使用与部署步骤见 [PUBLISH.md](PUBLISH.md)。
