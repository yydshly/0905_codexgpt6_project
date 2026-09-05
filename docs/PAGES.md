# GitHub Pages 发布准备

记录日期：2026-09-05。**状态：配置已准备，本地子路径验收通过；尚未启用 GitHub Pages，也未执行线上发布。**

## 适用性与产物

应用由 Vite 生成静态 HTML、CSS、JavaScript，家具与材质在浏览器中生成，没有后端、API 密钥或运行时外部模型下载。适合 GitHub Pages。仓库已经是 public，无需改变仓库可见性。

预计站点地址为 `https://yydshly.github.io/0905_codexgpt6_project/`。该地址当前不是已上线成果。

- `npm run build:pages`：生成 `dist-pages/`，使用 `/0905_codexgpt6_project/` 为资源路径。
- `npm run preview:pages`：在 `http://127.0.0.1:4174/0905_codexgpt6_project/` 预览该产物。
- `npm run test:pages`：自动构建和预览，复用完整十项浏览器验收。运行前关闭已开启的 4174 预览；不会复用旧构建服务。
- 普通 `npm run dev`、`npm run build` 和 `npm run preview` 仍使用根路径，不受发布模式影响。
- 如果将来更名仓库或改为自定义域名，需同步修改 `vite.config.js` 中的 Pages base 和 `playwright.pages.config.ts` 中的验收地址。

## 实际本地验证

Windows 11、Node.js 22.15.0、Google Chrome 152.0.7977.82、Playwright 1.62.1。通过真实浏览器访问上述仓库子路径，**10/10 通过，整次运行 37.6 秒**，包含构建和启动。

实际执行：默认书房 → 添加台灯 → 拖动 → 旋转 → 调光 → 家具材质 → 深夜 → 撤销/重做 → 本地保存 → 刷新恢复 → PNG 下载 → JSON 下载并重新上传 → 关键数据比较。文件导出为真实浏览器下载，导入为真实文件上传，没有替换场景数据以模拟操作。

同时检查了物件跟随、边界、删除撤销、镜头模式、命名、旧 v1 文件、无效文件保留原方案、无 WebGL 与存储失败反馈。已查看 1440×900 默认画面、1280×800 俯视及深夜选中截图，构图与属性面板保持可用。

HTML 中的图标、JS、CSS 均指向仓库子路径，实际 HTTP 响应全部为 200，类型分别为 SVG、JavaScript、CSS。详细数据见 [本地发布验收记录](evidence/pages-readiness.json)。本轮完整临时截图、导出文件和性能数据保存在 `test-results/pages-evidence/`；原产品六张交付截图仍见 [验收报告](VERIFICATION.md)。

构建仍有单个 JavaScript 包超过 500 kB 的 Vite 提示；本轮约 677 kB 未压缩。没有将该提示隐藏，也没有仅为消除提示改变现有 3D 加载方式。

**未验证：实际 GitHub Pages 的 HTTPS 加载、CDN 资源响应和线上保存/文件往返。** 本地子路径通过不能代替这些在线验证；获得发布确认后执行。

## 发布流程与权限

工作流为 [pages.yml](../.github/workflows/pages.yml)，仅支持手动触发、仅允许 main 分支，提交代码不会自行发布。

1. 仓库所有者确认启用公开 Pages 站点及部署 job 所需权限。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions → Publish study editor to GitHub Pages → Run workflow** 选择 main。
4. 工作流安装依赖、进行依赖审计，在仓库子路径构建并完成全部十项浏览器验收，然后上传经过验收的 `dist-pages/`。验收失败时不会部署。
5. deploy job 使用官方 GitHub Pages Actions 发布同一工作流产物；成功后输出实际站点 URL。
6. 在实际 HTTPS 地址重新验证默认 3D、保存恢复、PNG 和 JSON 往返，再把本文件状态改为已上线，并记录部署 run 和在线证据。

构建 job 仅有 `contents: read`。部署 job 才声明 `pages: write` 与 `id-token: write`，分别用于发布 Pages 与生成部署身份令牌。没有请求新的个人访问令牌、没有修改现有令牌范围、没有自动启用 Pages。用户原要求「涉及新增费用、删除用户数据或扩大权限时，先确认」，因此公开站点启用与这些发布权限需先确认。

## 本地方案迁移与后续补充

每位访问者的方案保存在自己的浏览器中，GitHub 不会接收方案数据。线上 `https://yydshly.github.io` 与本机 `http://127.0.0.1:5173` 是不同来源：先在本机导出 JSON，再在线上导入并保存。GitHub Pages 同一域名下的不同路径共享浏览器存储来源，当前应用使用专用键 `ideal-study.plan.v1`。

当前桌面第一版已完成核心闭环。进一步扩大使用范围前，建议补充 Safari/Firefox 实机检查、40 件物件及长时间编辑的压力验证；手机完整属性编辑仍在首版范围之外。上述项目当前未验证或未实现，不作为已完成声明。

## 配置来源

- [Vite 静态站点 / GitHub Pages 部署指南](https://vite.dev/guide/static-deploy.html)：仓库子路径需要对应的 base。
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)：发布产物、部署权限和 environment。
- 使用官方 Actions 发布版本：configure-pages v6.0.0、upload-pages-artifact v5.0.0、deploy-pages v5.0.1；2026-09-05 通过 GitHub 官方 release API 核实。
