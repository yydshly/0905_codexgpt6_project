# 工程删除与直接返回 · 改进记录

2026-09-05，基线 3552f75，分支 codex/project-library。根据用户提出的两个操作缺口直接实施，沿用 interactive-frontend-refinement 的局部修复流程。

## 范围与验收约定

保留现有暖白/苔绿布局，删除使用克制的红色提示。工程卡片增加删除入口，确认显示工程名称、保存版本数量和不可撤销说明，并提供当前 JSON 备份。仅在用户确认后删除指定工程及全部版本；保留其他工程、旧快速存档及迁入标记。使用同一事务并检查版本，防止部分删除或删除另一个页面刚保存的内容。

房间、短片、作者作品展示的「我的工程」菜单同时提供保存返回和不保存返回。无修改直接返回；未保存修改先确认，可取消并继续编辑。确认离开不写入工程或版本。原保存返回和另存为保留。

测试使用隔离浏览器中的临时工程，不删除或改动用户数据。不扩展回收站、批量删除或账号能力。

## 覆盖记录

规范入口 `npm run dev` → http://127.0.0.1:5173/?workspace=projects；生产检查 `npm run build` + `npm run preview` → 4173。

| 验收面 | 状态 | 下一步 |
| --- | --- | --- |
| 真实页面复现入口缺失 | pass | `.scratch/project-actions/before.json`、`before-library.png`、`before-menu.png`，原卡片无删除、菜单仅保存返回 |
| 删除取消/确认/备份/刷新、空状态 | pass | 下载 JSON 与删除前内容逐字段一致，删除后刷新仍为空 |
| 删除事务失败、并发更新、旧存档不重新迁入 | pass | 真实版本删除时注入事务 abort，工程与版本整体回滚；并发更新拒绝删除；迁入标记和原始字节保留 |
| 房间/短片/作品的直接返回、脏数据取消/放弃 | pass | 三个页面未修改直接返回；房间、短片、作品导入、快速房间放弃后存档不变；无额外浏览器离开提示 |
| 保存返回及另存为邻接回归 | pass | 工程完整套件 9 项通过，含版本恢复、分别发布、配额回滚与无 WebGL 管理 |
| 1440×900、1280×800、390×844 布局与键盘 | pass | 5 张运行截图；Enter/Escape、取消焦点与删除后焦点验证；移动端确认按钮可达 |
| 构建、截图、文档与 GitHub 记录 | pass | TypeScript、生产构建、Pages 构建通过；证据随本次提交保存 |

## 真实验证结果

Windows 11、Chrome 152.0.7977.82、Node 22.15.0、Playwright 1.62.1，DPR 1，实际 Chrome WebGL 场景。使用隔离上下文，无用户工程被修改或删除。

- `npm run build` 通过；Three.js 原大包提示保留，无新增依赖或存储版本迁移。
- `npx playwright test tests/projects.spec.ts`：**9/9 通过，40.9 秒**，无重试/跳过。
- `npx playwright test --config playwright.pages.config.ts tests/projects.spec.ts --grep '删除|不保存返回'`：**4/4 通过，25.7 秒**（含 Pages 构建启动），实际地址 `http://127.0.0.1:4174/0905_codexgpt6_project/`。
- 删除后尚未关闭的编辑标签页保存会报告「已被删除」，实际另存为仍可保留内容；保存失败时也能明确放弃后离开。
- 页面错误为 0。时长是验收执行时间，不是产品加载性能；本轮未改变场景渲染或资产，没有重复测量 GPU 帧率。

## 截图与记录

- [卡片删除入口 · 1440×900](project-actions-evidence/07-delete-entry-1440x900.png)
- [删除确认 · 1280×800](project-actions-evidence/08-delete-confirm-1280x800.png)
- [窄屏删除确认 · 390×844](project-actions-evidence/09-delete-mobile-390x844.png)
- [两种返回选择 · 1440×900](project-actions-evidence/10-return-choices-1440x900.png)
- [放弃未保存修改确认 · 1280×800](project-actions-evidence/11-discard-confirm-1280x800.png)
- [删除前实际下载的临时工程备份](project-actions-evidence/deleted-project-backup.json)
- [删除操作结果](project-actions-evidence/deletion.json)、[不保存返回结果](project-actions-evidence/leave-without-saving.json)、[完整验收与文件校验值](project-actions-evidence/acceptance.json)

原多工程云端结果仍对应其原提交；本次 GitHub CI 结果以本次提交的 Actions 状态为准，不将先前通过结果作为本次验证。未执行公网部署，也未验证 Safari/Firefox 或真实移动设备。删除永久生效且无回收站，JSON 仅备份当前工程；删除工程不会删除外部已经发布的网站。范围内没有遗留验收问题，此次修复闭环结束。
