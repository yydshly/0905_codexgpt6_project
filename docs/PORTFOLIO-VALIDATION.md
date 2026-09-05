# 作品入口 · 真实运行验收

## 范围与版本

- 原成果已提交并推送：`428cd19`，分支 `codex/reusable-study`，工作区无遗漏修改。
- 新增功能提交 `78e9382`；图片总量保护 `8397179`；慢速渲染下暂停处理修正 `4b6b936`，分支 `codex/portfolio-interactions`。
- 没有合并 main、部署新页面或覆盖线上旧数据。
- 作者配置书籍/屏幕、项目详情、图文封面、作品列表、模型拾取、隐藏标记、独立 GLB 关联以及宿主事件均为真实实现。

## 浏览器环境

2026-09-05，Windows 11 Home Chinese 26200，Node 22.15.0、Playwright 1.62.1，已安装 Chrome 152.0.7977.82（headless），DPR 1。GPU 实际报告为 Intel UHD / ANGLE D3D11；没有把机器的独显型号当作本次渲染设备。

开发服务：`npm run dev`，http://127.0.0.1:5173/ 。生产验收：`npm run build && npm run preview`，http://127.0.0.1:4173/ 。额外 Pages 验收：`npm run build:pages && npm run preview:pages`，http://127.0.0.1:4174/0905_codexgpt6_project/ 。测试使用隔离的浏览器上下文，不写用户正在使用的浏览器存档。

## 操作结果

| 真实浏览器流程 | 结果 / 证据 |
| --- | --- |
| 选中书桌 → 项目名称、简介、标签、链接、上传封面 → 应用 | pass；截图 01 |
| 显示器关联第二项目 → 修改书桌位置/旋转/材质 → 深夜 → 撤销重做 | pass；项目数据不变 |
| 删除书桌及其桌面物件 → 撤销 | pass；绑定、物件和选中状态同步恢复 |
| 保存 → 刷新 → 下载 JSON → 重新导入 | pass；方案逐字段相同 |
| 展示页 → 隐藏 DOM 标记 → 真正点击书籍几何 | pass；弹出正确项目与封面 |
| 拖动物件所在区域旋转观察 | pass；不打开详情、不移动家具 |
| 播放短片 → 暂停 | pass；播放时停用入口，暂停后恢复 |
| 旋转到显示器背后 → 恢复视角 | pass；被机身遮挡的屏幕入口隐藏，回到正面恢复 |
| 项目详情 →「访问项目」 | pass；实际新标签页地址为本仓库 URL |
| GLB 页面下载 → 独立 GLTFLoader 打开 → 关联相同 JSON → 点击屏幕入口 | pass；读取模型 extras，显示相同项目；截图 04 |
| 宿主网页导入 JSON → 点击 iframe 中屏幕 → 宿主显示详情 | pass；接收 activateProject 事件 |
| 非法协议、损坏图片、重复/孤立入口、未知版本 | pass；错误反馈，原方案不变 |
| 大量封面+墙面照片超过 5 MB | pass；应用/导入前阻止，确保正常生成工程可在 6 MB 上限内重新导入 |
| 房间 v1/v2、短片 v2/v3 文件及上一版本地存档迁移 | pass；升级为空作品配置，保留家具/照片/镜头，旧键字节保留 |
| 键盘打开详情、Escape、焦点返回、可见焦点环 | pass |
| 390×844 夜间详情、无 WebGL、减少动态、未关联作品 | pass；无 WebGL 时作品列表与访问链接仍可用 |

详见 [journey.json](portfolio-evidence/journey.json)、[states.json](portfolio-evidence/states.json)、[performance.json](portfolio-evidence/performance.json) 与 [acceptance.json](portfolio-evidence/acceptance.json)。

## 检查与截图

- 原房间、短片、照片与复用回归 **21/21 通过**，114.37 秒。
- 新增作品验收 **5/5 通过**，初轮 23.62 秒；最终测试修正后再次 **5/5 通过**，36.5 秒。
- Pages 仓库子路径 **5/5 通过**，29.83 秒，对应 `78e9382`。
- 图片总量保护追加错误流程 **1/1 通过**，6.56 秒，对应 `8397179`；此修正不改变渲染和路由。
- `npm run build` / `npm run build:pages` 通过，npm audit 无漏洞。
- 暂停处理修正后完整视频流程 **1/1 通过**（28.3 秒），另在真实 SwiftShader Chrome 中验证按下暂停、保持、松开不重播，以及 Enter 播放/暂停。
- GitHub 首个功能提交 `78e9382` 的 **26 项全部通过**：[33954590071](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33954590071)。
- `8397179` 的作品流程 5 项通过，但原短片回归出现暂停后播放头仍前进的失败（[33954823081](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33954823081)）。未归咎于图片校验，也未重试后隐去原失败；在 `4b6b936` 改为主指针按下即暂停，并消费同次 click 防止重新播放，键盘点击保留。
- `4b6b936` 云端重验中，房间、短片、复用 **21/21 通过**；作品流程 **4/5 通过**（[33955146891](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33955146891)）。trace 显示测试第二次点击实际发生在第一次播放约 12.3 秒之后，10 秒短片已自然结束，按钮已变为「播放短片」，因此触发重新播放。它是测试时序问题，未据此修改正确的播放器结束行为。
- `bd0feea` 将按钮定位放在播放前，再用真实鼠标坐标点击，增加暂停状态、未到片尾、等待后播放头不变的断言，没有重试、跳过或放宽断言。真实 SwiftShader 另验证 1.2 秒暂停、Enter 切换，以及播放到 10 秒自然结束后恢复作品入口：[gallery-pause.json](portfolio-evidence/gallery-pause.json)。
- 最终测试版本云端记录：[33955649267](https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33955649267)，状态与逐项结果见 acceptance.json。未完成的任务不计通过。

五张保留的图片均为实际运行截图：

| 图片 | 场景 |
| --- | --- |
| [01-author-1440x900.png](portfolio-evidence/01-author-1440x900.png) | 作者配置、真实图片上传、焦点状态 |
| [02-portfolio-1440x900.png](portfolio-evidence/02-portfolio-1440x900.png) | 布置后的作品书房与两个入口 |
| [03-project-detail-1280x800.png](portfolio-evidence/03-project-detail-1280x800.png) | 封面、项目详情、访问按钮 |
| [04-independent-glb-1280x800.png](portfolio-evidence/04-independent-glb-1280x800.png) | 独立 GLB 加载与作品入口 |
| [05-mobile-detail-390x844.png](portfolio-evidence/05-mobile-detail-390x844.png) | 窄屏、夜间、详情面板 |

视觉修正来自运行结果：先修正旧开发服务模块缓存，确认新代码运行；继而修正封面 grid 内容溢出、通用按钮规则覆盖入口样式，以及场景与前景控件的层级。遮挡测试初次拖动方向没有转到屏幕背后，改为实际背面角度后检查通过，没有削弱遮挡判定。

## 性能及原视频回归

作品页 localhost 导航到 ready 378 ms；1440×900 窗口中 canvas 为 1200×657。真实场景 94,942 三角形，171 mesh / 15 instanced batches，记录 349 render calls。初始三个渲染耗时约 102.9 / 82.1 / 4.1 ms，包含初始准备；空闲 0.5 秒新增渲染 0 次。空闲 requestAnimationFrame 平均 4.15 ms、P95 4.3 ms，**这是浏览器调度间隔，不是持续交互 FPS 或 GPU 帧率保证**。未做多实例/大型图片极限负载测试。

保留视频功能在最终暂停修正后的实际回归：下载并打开 H.264 MP4，1280×720、10.2 秒、6,183,033 字节；预览与视频在 1.2 / 4.9 / 8.7667 秒的像素平均差约 1.19 / 1.71 / 1.73（0–255），镜头与采样器一致，文件已原生回放。[视频检查记录](portfolio-evidence/film-regression.json)。该检查验证保留的短片功能，不声称视频携带作品点击事件。视频文件没有重复加入本轮提交；既有实际视频在 `docs/film-evidence/`。软件渲染暂停见 [software-pause.json](portfolio-evidence/software-pause.json)，播放头 3.3 秒按下后保持不变。

同一修正代码在 GitHub Ubuntu Chromium 151.0.7922.34 中也完成实际导出与回放：H.264、1280×720、10.2 秒、4,892,270 字节，三个时间点的平均像素差 2.76 / 3.43 / 2.78。编码器与环境不同，未要求文件字节相同：[云端视频记录](portfolio-evidence/cloud-film-regression.json)。

## 可带走的成果和边界

[实际 JSON](portfolio-evidence/portfolio-room.json) 与 [同次下载 GLB](portfolio-evidence/portfolio-room.glb)：GLB 3,780,852 字节、410 mesh、94,940 三角形、5 张贴图，加载后可读取 book-1 / screen。书桌移位、旋转、胡桃木材质及项目配置均在工程中。封面属于 JSON，不是 GLB 的屏幕纹理。

作品入口第一版只覆盖桌面现有书和显示器屏幕。尚未实现任意模型部位绑定、书籍封面贴图、屏幕内操作网站、云端作品存储。展示页导入为当前会话，刷新回到路由对应的本地保存或示例。作者编辑仍以桌面为主。

未实测：Safari/Firefox、真实手机 GPU、跨域部署后的宿主、原生 App WebView、React/Vue 业务工程、Blender/Unity/Unreal、模型经其他软件重建后的标识保留。这些未计为已验证。GitHub Pages 线上仍为原版，此分支未部署。
