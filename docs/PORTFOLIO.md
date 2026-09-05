# 让书籍和屏幕成为作品入口

> 本文保留第一轮作品入口与 API 说明。当前已扩展为 11 类物件关联、portfolio v2、40 个作品/80 个入口，并支持独立网站 ZIP。当前操作以 [PUBLISH.md](PUBLISH.md) 为准；下文 v1 数据和两部位范围属于历史版本。

当前分支 `codex/portfolio-interactions`，基线 `428cd19`（已推送的完整家具、短片与模型复用版本）。这是增量扩展，保留原有布置和短片操作；尚未合并到 main 或部署到 GitHub Pages。

## 在产品里配置

1. `npm ci`，`npm run dev`，打开 http://127.0.0.1:5173/?workspace=room 。
2. 选中书桌或显示器，在右侧「作品入口」点击「关联我的作品」。桌面那本现有的书和显示器屏幕是第一版支持的部位。
3. 新建作品，填写名称、简介、技术栈与完整 HTTP(S) 地址；可以上传封面。也可以选择已有作品，让多个物件共用同一份介绍。
4. 点击「应用关联」。这是一次可撤销的编辑；取消弹窗不修改工程。修改已有作品会同步它的其他入口；「取消关联」保留作品内容，之后可以重新选择。
5. 点击顶部「3 作品展示」。应用先保存当前工程，成功后进入对应的展示页。保存失败会留在原页。
6. 展示页可点击 01/02 标记、实际书籍/屏幕，或底部作品卡片。弹窗展示封面与介绍；「访问项目」在新标签页打开。拖动仅旋转观察，滚轮缩放；短片播放期间关闭点击入口，暂停后可继续探索。

默认演示：http://127.0.0.1:5173/?workspace=portfolio 。它使用本项目真实 GitHub 仓库和已发布的原版编辑器作为两个示例，明确标记「示例作品」，不会写入个人存档。

个人方案预览 `?workspace=portfolio&project=room`；当前短片的房间预览 `?workspace=portfolio&project=film`。这两个路由只读取对应的本地保存。直接导入 JSON 仅影响当前展示会话，不冒充云保存，不覆盖编辑器。刷新重新读取路由指定的存档；导入后的会话可以导出 JSON 带走。

## 保存与迁移

| 数据 | 当前版本 | 浏览器保存键 |
| --- | --- | --- |
| 房间 | `ideal-study` v3 | `ideal-study.plan.v3` |
| 短片 | `ideal-study-film` v4，内嵌房间 v3 | `ideal-study.film.v4` |
| 作品内容与绑定 | `scene.portfolio` / `plan.portfolio` v1 | 随工程一起保存 |

旧房间 v1/v2、旧短片 v2/v3 仍可打开；新增作品配置为空，房间、照片、家具和镜头保留。读取顺序是最新键优先，再向旧版本回退；旧键不会被覆盖。文件先校验和解码，再一次性替换当前工程。非法 URL、重复入口、找不到的家具、损坏封面或未知版本不能破坏当前方案。

绑定使用 `{ itemId, partId }`。书桌的部位为 `book-1`，显示器为 `screen`。修改材质重建模型后仍使用同样的标识；移动/旋转家具不改变绑定。删除书桌及显示器会一起移除其绑定，撤销同时恢复；作品内容保留。

第一版最多 12 个作品、40 条绑定，受原有 40 件物件限制。封面支持 JPG/PNG/WebP，输入最大 8 MB，经处理转为最长边 1024 像素、最长 450,000 字符的内嵌 JPEG。内嵌封面与墙面照片合计最多 5 MB，应用前校验，为结构、文字和镜头留出空间；单份 JSON 上限仍为 6 MB。大工程可能触及浏览器本地存储限额，保存失败会提示使用 JSON 备份。

## 接入自己的网页：复用当前播放器

此接口是仓库中的源码模块，不是已发布的 npm 包。复制/引入 `player.ts` 及其依赖，保留 CSS 和图片处理模块；源文件依赖使用的 Three.js 版本见 package.json。框架挂载后创建播放器，组件卸载时销毁。

```ts
import { createStudyPlayer } from './study/player';

// host 需要明确尺寸和 position: relative，例如宽 100%、16:9。
const response = await fetch('/assets/my-study.json');
if (!response.ok) throw new Error('工程加载失败');
const player = await createStudyPlayer(host, await response.json());

const unsubscribe = player.onActivate(({ project, target, action }) => {
  // 用自己产品的详情组件展示，文字用 textContent / 框架默认转义。
  openProjectPanel(project);
  // project: id/title/description/tags/url/cover
  // target: itemId + partId; action: openProject
});

player.resetView();                  // 暂停短片，恢复房间默认观察视角
player.setMarkersVisible(false);     // 隐藏标记，实际模型仍可点击
player.setMood('night');             // 与现有 API 相同
// 离开页面/卸载组件：unsubscribe(); player.destroy();
```

其他已存在方法：`loadProject`、`setMaterial`、`seek`、`play`、`pause`、`getState`、`getProject`。点击事件只通知内容，不替宿主自动跳转或写入保存。`getProject()` 返回拷贝；访客的临时镜头观察不会修改短片镜头数据。短片仍使用同一个 sampleFilm 时间采样。

### iframe

同域部署的完整示例在 `?workspace=integration`。「载入可点击作品示例」或导入自己的工程，然后在 iframe 中点击书/屏幕；详情弹窗由宿主网页渲染。

原消息协议 `channel: ideal-study, version: 1` 保留；连接成功后新增主动事件：

```js
window.addEventListener('message', event => {
  if (event.source !== iframe.contentWindow || event.origin !== playerOrigin) return;
  const data = event.data;
  if (data?.channel !== 'ideal-study' || data.version !== 1) return;
  if (data.event === 'activateProject') {
    openProjectPanel(data.detail.project);
  }
});
```

初次连接先通过既有 `getState` 消息确认就绪，再 `loadProject`。新增命令 `resetView`、`setMarkersVisible`（布尔 payload）。详细请求/响应格式见 [REUSE.md](REUSE.md)。跨域宿主仍需在 `embed.ts` 的 `allowedParentOrigins` 中加入确切域名后构建，默认仅同源；不使用 `*`。

## 使用独立 GLB：模型与工程一起带走

1. 在房间导出菜单下载 **GLB** 和同一份 **JSON 工程**。
2. 打开 `?workspace=viewer`，选择 GLB，再选择「关联工程 JSON」。
3. 查看「已关联 N 个作品入口」，点击屏幕或书的标记，确认能打开同一个作品。

该查看器只调用 GLTFLoader 与独立适配器，不调用 StudyScene 或家具建模代码。导出保留 `extras.itemId` 与子节点 `extras.partId`，导入后由 Three.js 放入 `userData`。封面和简介在 JSON 内，GLB 中不包含执行脚本。

可复用适配器：`src/glb-portfolio.ts`，需要 `hotspots.ts`、`portfolio-model.ts` 与 `portfolio.css`；接收现成的 root/camera/canvas/OrbitControls 和经过校验的 portfolio 数据：

```ts
import { attachGLBPortfolio } from './study/glb-portfolio';
import { parseFilmProject } from './study/film-model';
import { preparePhotos } from './study/photos';

const project = parseFilmProject(rawJSON).project;
await preparePhotos(project.scene);
const interactions = attachGLBPortfolio(
  host, gltf.scene, camera, renderer.domElement, controls,
  project.scene.portfolio, event => openProjectPanel(event.project)
);
console.log(interactions.matched, interactions.missing);
// 更换模型或卸载时：interactions.destroy();
```

此适配器的遮挡判定覆盖传入 root 中的模型。目标产品额外添加的遮挡几何需要纳入 root 或自行扩展拾取集合。模型经过其他软件合并、重建或改名时，应保留上述 extras；如果部位标识丢失，不能自动恢复绑定。单件 GLB 只匹配该物件的入口，其他绑定作为 missing 告知。

## 边界

- 本轮封面显示在网页作品详情里；未将封面贴到 3D 屏幕或书封面。未实现屏幕中操作任意网站、视频纹理、任意书架书籍/墙画的绑定。
- 布置作者优先桌面；展示页支持窄屏作品列表与详情。无 WebGL 时可从列表访问作品，不能操作 3D。
- JSON 工程是数据，GLB 是模型，网站交互由播放器/适配器承担；视频只包含已渲染画面，没有可点击物件。
- GLB 的后期效果与原渲染器不同。只在 Three.js 独立查看器实测，未验证 Blender、Unity、Unreal、真实 React/Vue 产品或 Safari/Firefox。
- 当前为本地保存/静态接入，无账号、服务器、云同步或作品自动发布。GitHub Pages 线上站点仍是原版。

实际工程、模型、截图和环境记录见 [PORTFOLIO-VALIDATION.md](PORTFOLIO-VALIDATION.md)。
