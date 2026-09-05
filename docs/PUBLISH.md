# 从房间到个人作品主页

当前分支 `codex/publishable-portfolio`，从 `df582ac` 增量扩展。所有 **11 类可选择物件**均可关联作品：书桌、椅子、显示器、书架、台灯、落地灯、植物、地毯、沙发、床、墙面相框。墙体、窗户和模型内部任意零件并非可单独编辑的物件。

## 作者流程

1. `npm ci`，`npm run dev`，打开 http://127.0.0.1:5173/?workspace=room 。
2. 选中任意物件，在右侧「作品入口」填写名称、简介、标签、封面和完整 HTTP(S) 链接。
3. 书桌与显示器可选择「整个物件」或「桌面书籍 / 显示器屏幕」，分别绑定不同作品；具体部位优先。其他家具绑定整体，书架内每一本书暂不单独绑定。
4. 原有移动、材质、灯光、删除、撤销重做、保存与刷新继续生效。删除家具时移除对应入口，撤销恢复；取消关联保留作品草稿。
5. 点击顶部「3 作品展示」，保存并预览对应房间。示例页 `?workspace=portfolio` 不会把示例写入你的存档。
6. 点击右上「发布展示页」，设置展示名称、页面标题和个人简介。房间/短片来源点击「保存设置并预览」会更新本地对应工程；示例/导入来源只更新本次预览，可导出 JSON 保留设置。
7. 再打开发布面板，点击「下载网站 ZIP」。按钮打包面板内的当前值；若尚未点击保存，它们会在 ZIP 中，但不冒充已保存到本地。下载失败可重试。

## 独立网站与部署

ZIP 包含 `index.html`、`assets/site.js`、`assets/site.css`、`project.json`、`.nojekyll`、许可和部署说明。访客直接打开即可探索，不需要导入文件、作者 localStorage 或编辑器。不会显示编辑、导入、导出或开发接入按钮；无 WebGL 时仍可从作品列表看详情和访问链接。

发布使用当前预览的同一套场景与作品数据、同一个 `mountPortfolioView` / `createStudyPlayer`。打包时清空选中状态、播放头归零，移除未关联的作品草稿。房间照片与已关联作品部署后公开可见。

先解压 ZIP，在目录用任意 HTTP 静态服务预览，例如 `python -m http.server 8080`，打开 http://127.0.0.1:8080/ 。不要双击 HTML，浏览器会限制本地文件的模块和 JSON 加载。

在 **自己的静态网站仓库**上传解压后的文件，确保 `index.html`、`project.json` 位于网站根目录，保留 `assets/` 文件夹。Settings → Pages → Source 选择 **Deploy from a branch**，选择对应分支与 `/(root)` 后保存。已有 Pages Actions 的仓库则让工作流上传解压后的目录。规则见 [GitHub 官方创建站点说明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

文件采用相对路径，支持 `https://用户名.github.io/仓库名/` 和独立域名根目录，也可放在其他静态服务器上。站点无需 npm 构建。更新时重新下载、替换文件并部署。ZIP 下载不会自动生成公开网址或修改现有站点。

本轮没有覆盖本仓库现有 Pages 编辑器，没有新建收费服务。实际验证覆盖独立本地服务器的根路径和仓库式子路径；尚未把这份个人示例发布为公网网站。自己的产品内容和目标仓库可按上述流程替换。

## 数据与二次开发

房间仍为 v3、短片为 v4；嵌套 `portfolio` 从 v1 升为 **v2**，新增 `presentation: { name, headline, bio }`。旧绑定和物件保留，v1 迁移为默认介绍。旧编辑器不认识 v2，继续编辑应使用当前或更新版本。

目标为 `{ itemId, partId }`，`partId` 支持 `object`、`book-1`、`screen`。每个目标最多一个作品，多个物件可共用作品。上限 40 个作品、80 个入口，并受 40 件物件上限限制；内嵌照片/封面共 5 MB，JSON 上限 6 MB。

GLB 根节点保留 `extras.itemId`，书籍/屏幕子节点保留 `extras.partId`。整体入口不要求额外建模。独立适配器 `glb-portfolio.ts` 依赖新增的 `content-anchor.ts`；拾取只认首个可见物体，不透过家具激活后方作品。源播放器和 iframe 的 `activateProject` 事件保持兼容。API 示例见 [PORTFOLIO.md](PORTFOLIO.md)，目标类型与依赖以当前源码为准。

ZIP 是可运行网站，JSON 是工程，GLB 是模型；视频是固定画面，不携带点击行为。

## 构建与边界

`npm run dev`、`npm run build`、`npm run build:pages` 都先运行 `scripts/build-site-kit.mjs`，生成 `public/site-kit`。该目录由构建生成并被 Git 忽略。修改运行时代码后须重新构建；作者页面热更新不替代发布模板构建。

桌面优先编辑；访客页支持窄屏。移动版标题最多两行、简介主要在桌面显示，作品详情可滚动完整阅读。未实测 Safari、Firefox、真实手机 GPU、自定义域名、跨域 iframe、原生 WebView；未测 40 物件/80 入口极限负载。模型经外部软件合并并丢失标识后，需要重新映射。

ZIP 打包使用 [fflate](https://github.com/101arrowz/fflate) 0.8.3，MIT 许可已记录。没有新增外部模型或图片，继续复用原自制几何与材质。无需账号、云同步或大模型服务。

真实截图、ZIP 和测试见 [PUBLISH-VALIDATION.md](PUBLISH-VALIDATION.md)。
