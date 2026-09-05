# 理想书房 · 布置、短片与个人作品集

一间可编辑、可拍摄，也可作为作品入口的 3D 书房。复用原有家具、材质和灯光，新增桌面书籍与显示器屏幕的作品绑定。

当前分支：[codex/publishable-portfolio](https://github.com/yydshly/0905_codexgpt6_project/tree/codex/publishable-portfolio)，从 `df582ac` 继续扩展。11 类可选物件都可关联作品；新增个人标题、介绍和独立网站 ZIP 导出。未覆盖线上站点，GitHub Pages 仍是[原版布置器](https://yydshly.github.io/0905_codexgpt6_project/)。

## 启动与入口

Node.js 22.12+，支持 WebGL 2 的桌面浏览器：

```bash
git switch codex/publishable-portfolio
npm ci
npm run dev
```

- [布置书房](http://127.0.0.1:5173/?workspace=room)：选中任意家具，在右侧「作品入口」配置作品。书桌和显示器另支持具体部位。
- [作品展示示例](http://127.0.0.1:5173/?workspace=portfolio)：直接点击书籍或屏幕、标记或作品列表，打开项目详情。
- [短片工作台](http://127.0.0.1:5173/?workspace=film)：默认入口，已编排 10 秒作品，支持最多 3 段镜头与真实视频导出。
- [网页接入示例](http://127.0.0.1:5173/?workspace=integration)：宿主控制 iframe，接收作品点击事件并展示详情。
- [独立 GLB 查看器](http://127.0.0.1:5173/?workspace=viewer)：打开导出的 GLB 和对应 JSON，继续点击作品入口。

房间与短片顶部均有「3 作品展示」，先保存对应工程再预览。独立房间与已有短片保留各自存档，进入当前短片的房间请用「1 布置书房」。示例展示页不写入个人存档。

```bash
npm run build
npm run preview  # http://127.0.0.1:4173/
npm test         # 30 项真实浏览器检查
npx playwright test tests/publish.spec.ts
npx playwright test tests/portfolio.spec.ts
npx playwright test --config playwright.pages.config.ts tests/portfolio.spec.ts
```

本机测试使用已安装的 Chrome，CI 使用 Chromium。运行时不需要账号、API 密钥或云服务，也不下载外部模型/字体。不要直接双击 HTML；请使用 HTTP 服务。

## 保存与带走作品

房间 v3、短片 v4、作品配置 v2；当前保存键为 `ideal-study.plan.v3` 与 `ideal-study.film.v4`。旧房间 v1/v2、短片 v2/v3、作品配置 v1 会迁移。保存仅在当前浏览器，刷新保留已保存方案，撤销历史不跨刷新。

**发布个人主页：**布置并关联作品 → 顶部「3 作品展示」→「发布展示页」设置介绍 → 下载网站 ZIP → 解压部署。访客打开即能探索，不依赖作者存档。启动与构建命令自动生成发布模板。详见[使用与部署指南](docs/PUBLISH.md)。

GLB 带走模型、材质和部位标识；JSON 带走房间、照片与作品绑定，短片工程另含镜头数据。配合当前播放器或独立 GLB 适配器接入自己的网页。视频为固定画面，不含可点击物件。

视频导出保留原能力：实际检测 H.264/VP9/VP8，生成 MP4/WebM，无音轨 1280×720、30fps。预览、拖动时间轴和逐帧编码共享镜头数据；真实编码和浏览器解码验证完成后才提供下载。需要 HTTPS 或 localhost/127.0.0.1 安全上下文。

## 文档与实际交付

- [通用作品入口、个人网站发布与兼容边界](docs/PUBLISH.md)
- [本轮真实截图、发布 ZIP 与验证记录](docs/PUBLISH-VALIDATION.md)
- [作品配置、接入代码与兼容边界](docs/PORTFOLIO.md)
- [本轮验证、性能和已知限制](docs/PORTFOLIO-VALIDATION.md)
- [实际可导入工程](docs/portfolio-evidence/portfolio-room.json) · [对应 GLB](docs/portfolio-evidence/portfolio-room.glb)
- [原播放器/iframe 接口](docs/REUSE.md) · [资产来源](docs/ASSETS.md) · [第三方许可](THIRD_PARTY_LICENSES.txt)
- 历史记录：[家具与复用验收](docs/REUSE-VALIDATION.md) · [短片验收及视频](docs/FILM-WORKBENCH.md)

![实际运行的作品书房，1440×900](docs/portfolio-evidence/02-portfolio-1440x900.png)

当前入口覆盖全部 11 类物件的整体，并保留书籍与屏幕的部位绑定。封面显示在网页详情中；未实现屏幕内操作网站、云同步或自动上传到托管平台。GLB 的独立渲染效果会有差异，未测试其他原生 3D 软件。

以下保留原版的部署说明与历史编辑器记录，历史性能/截图不代替本轮证据。

## GitHub Pages 部署

原版已于 2026-09-05 在用户确认后启用公开站点并完成首次发布，当时十项子路径验收通过。[发布工作流](.github/workflows/pages.yml) 只接受 main 上的手动触发。此短片分支不会自行更新线上版本。

线上地址：[https://yydshly.github.io/0905_codexgpt6_project/](https://yydshly.github.io/0905_codexgpt6_project/)。[首次发布成功记录](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33944881617)；浏览器线上复验、更新步骤与权限说明见 [发布说明](docs/PAGES.md)。

```bash
npm run build:pages
npm run preview:pages
# 打开 http://127.0.0.1:4174/0905_codexgpt6_project/
```

停止上述预览后运行 `npm run test:pages`，可自动构建、启动并验收 Pages 子路径。构建产物在 `dist-pages/`，原编辑器证据在 `test-results/pages-evidence/`，短片测试文件仍写入 `test-results/film-evidence/`。本次只实际重跑了子路径下的短片完整流程（1/1），完整 16 项在根路径执行。

运行 `npm run test:live` 可在真实线上 HTTPS 地址重跑十项验收，不启动本地服务器。它使用隔离的测试浏览器上下文，证据位于 `test-results/live-evidence/`，不会覆盖用户现有浏览器的存档。

线上地址与本机开发地址的存档不互通；通过 JSON 导出、导入迁移。上线不会增加云同步，也不会上传访问者的方案。

## 原空间布置器的使用

1. 通过 `/?workspace=room` 进入原空间布置器。点击左侧物件缩略图添加物件，新物件会自动选中。
2. 在「布置」模式中，点击场景物件选择并拖动；选中名称悬浮显示，拖动时显示实时坐标。位置吸附到 0.1 m 网格，限制于房间内；台灯和显示器约束在所属书桌上。
3. 右侧顶部可直接切换物件，名称旁可重命名；重复物件自动编号。右侧修改 X/Z 坐标、朝向、材质；灯具支持开关和亮度。书桌移动或旋转时，桌面物件一起跟随。
4. 切换「观察」模式后，左键拖动旋转镜头；两种模式均支持右键观察、滚轮缩放。上方可切换默认、俯视和近景，右下可恢复默认视角。手动旋转或缩放后，视角预设取消高亮；保存和刷新后仍与实际镜头一致。
5. 底部切换白昼、黄昏、深夜，实际改变光源强度、颜色、方向、环境光和窗外颜色。
6. 修改顶部名称，点击「保存方案」。刷新同一地址可恢复。通过「导出」下载 PNG、JSON，或重新导入 JSON 继续编辑。

| 快捷键 | 操作 |
|---|---|
| V / C | 布置 / 观察 |
| 方向键 / Shift + 方向键 | 移动选中物件 0.1 / 0.5 m |
| R | 旋转 15° |
| Delete / Backspace | 移除选中物件 |
| Esc | 取消选择、关闭弹窗或物件库 |
| Ctrl / ⌘ + Z | 撤销 |
| Ctrl / ⌘ + Shift + Z，或 Ctrl + Y | 重做 |
| Ctrl / ⌘ + S | 保存到当前浏览器 |

## 保存与文件

- **本地保存**使用 `localStorage`，仅保存一个当前方案，手动点击保存才会覆盖旧存档。没有账号或云同步。浏览器清理站点数据后，存档可能丢失，建议导出 JSON 备份。
- 本地存储按浏览器、协议、域名和端口隔离。`localhost` 与 `127.0.0.1`，开发端口 `5173` 与预览端口 `4173` 的存档不互通；可用 JSON 文件迁移。
- **PNG**是当前镜头的 2 倍画布分辨率，包含真实 3D 房间，不包含编辑面板和选中标记。
- **JSON v2**包含方案名称、物件、可选物件名称、坐标、朝向、材质、灯光、氛围、镜头和选择状态。最大 6 MB、40 件物件，支持内嵌照片，并可迁移旧 v1。导入先校验，失败保持当前方案，并在弹窗内说明原因；成功导入可撤销，保存后才写入本地存档。
- 撤销/重做保留最近 80 次编辑；连续拖动或拖动亮度滑杆记为一次。历史在当前会话内有效，刷新后从恢复的方案开始。

## 真实验证与截图

完整记录见 [验收报告](docs/VERIFICATION.md)，包含流程、实际环境、性能、修正记录和未验证边界。第二轮的造型、操作反馈与性能改进见 [优化报告](docs/REFINEMENT.md)；第三轮的物件切换、命名、旧文件兼容及导入保护见 [使用体验优化](docs/USABILITY.md)；本地完整浏览器验收 10/10 通过。

- [白昼默认 · 1440×900](docs/evidence/01-default-1440x900.png)
- [近景 · 1440×900](docs/evidence/02-close-1440x900.png)
- [俯视 · 1280×800](docs/evidence/03-top-1280x800.png)
- [深夜选中与灯光属性 · 1280×800](docs/evidence/04-night-selected-1280x800.png)
- [窄屏物件库抽屉 · 390×844](docs/evidence/05-narrow-library-390x844.png)
- [通过线上产品导出的 PNG](docs/evidence/06-exported-scene.png) / [通过线上产品导出的可编辑 JSON](docs/evidence/live-plan.json)

上述六张图片已更新为 GitHub Pages 线上复验的真实截图和实际导出文件，不是设计稿。第三轮本地性能和流程记录保留原始数据；本次线上数据与截图校验值见 [线上验证记录](docs/evidence/pages-live.json)。

运行浏览器验收（本地默认使用已安装的 Google Chrome）：

```bash
npm test
```

测试会自动构建并启动生产预览。没有安装 Chrome 时，可安装 Playwright Chromium，并把配置中的 `channel` 改为 `chromium`。GitHub Actions 已配置 Chromium 的安装和同一组验收；[查看构建与浏览器记录](https://github.com/yydshly/0905_codexgpt6_project/actions)。

## 源码组织

| 文件 | 职责 |
|---|---|
| `src/model.ts` | 唯一场景数据、默认布局、添加策略、约束、导入校验 |
| `src/geometry.ts` | 家具、建筑与装饰的程序几何，木纹和织物材质 |
| `src/scene.ts` | Three.js 渲染、真实灯光、阴影、SSAO、抗锯齿、拾取、拖动、镜头与 PNG |
| `src/main.ts` / `src/room-editor.ts` | 入口分流 / 保留原产品界面、属性、历史、存档和文件操作 |
| `src/studio.ts` / `src/studio.css` | 镜头工作台、时间轴、编辑历史、工程持久化与视频回放 |
| `src/film-model.ts` | v3 工程、旧版迁移、默认编排与唯一时间采样函数 |
| `src/film-export.ts` | 实际编码能力检测、逐帧 WebCodecs 编码和 MP4/WebM 封装 |
| `src/style.css` | 布局、视觉样式、交互状态与窄屏适配 |
| `tests/study.spec.ts` | 实际浏览器连续操作、文件下载、恢复和回归验收 |

家具与房间模型、画框图形、显示器内容和程序纹理由项目源码生成；没有导入外部家具模型。渲染引擎和图标库为外部开源依赖，详见 [资产来源](docs/ASSETS.md) 与 [第三方许可证](THIRD_PARTY_LICENSES.txt)。

## 第一版边界

固定 5.2 × 4.4 m 单房间。没有完整 CAD、复杂物理、账号、多人协作或云同步。

手动摆放允许家具相互交叠；实现的是房间和桌面约束，不是碰撞求解。台灯/显示器只能放在书桌上，移除书桌会一并移除桌面物件，支持撤销。书籍、键盘、杯子属于宿主模型细节；墙面相框已支持独立编辑。

桌面是本次完整编辑目标。窄屏提供场景观察与物件库抽屉，但手机端完整属性编辑未实现。未验证 Safari、Firefox、触屏设备及长期大负载使用；详情见验收报告。
