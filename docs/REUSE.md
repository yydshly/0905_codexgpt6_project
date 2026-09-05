# 把理想书房用于其他网页或产品

当前实现位于 `codex/portfolio-interactions`；本指南保留原复用接口，新增作品点击与独立 GLB 适配器见 [PORTFOLIO.md](PORTFOLIO.md)。运行 `npm ci`、`npm run dev`，默认仍是原短片工作台。此分支尚未部署到 GitHub Pages。

| 要做什么 | 使用什么 | 已实现入口 |
|---|---|---|
| 展示固定画面 / 视频 | PNG、MP4 / WebM | 房间「导出」、短片「导出视频」 |
| 保留家具、灯光、照片与镜头的编辑能力 | 房间 v3 / 短片 v4 JSON + 当前渲染源码 | `/?workspace=room`、`/?workspace=film` |
| 在自己的网页中用按钮控制场景 | `createStudyPlayer` 或 iframe 消息接口 | `/?workspace=integration` 为真实宿主示例 |
| 放进另一个 3D 项目 / 软件 | 整屋、选中物件 GLB | 房间「导出」；`/?workspace=viewer` 独立检查 |

## 最快的接入：iframe

从短片页的「布置书房」进入关联房间，布置后点击「返回短片工作台」，编排镜头并导出工程 JSON。独立房间与已有短片是两份存档，独立房间也可先导出 JSON，再导入短片页。在你的网页同一域名下部署本项目的生产构建，再嵌入 `?workspace=embed`。例如应用放在 `/study/`：

```html
<iframe id="study" title="3D 书房"
  src="/study/?workspace=embed"
  style="width:100%;aspect-ratio:16/9;border:0"></iframe>
```

参考可运行的 `src/integration.ts`，宿主发消息、等待带有相同 `id` 的成功或错误响应。需等待播放器可响应 `getState` 后再载入工程；示例包含就绪轮询和错误提示。

```js
const frame = document.querySelector('#study');
const playerOrigin = new URL(frame.src).origin;
let requestId = 0;
function command(command, payload) {
  const id = String(++requestId);
  frame.contentWindow.postMessage({
    channel: 'ideal-study', version: 1, id, command, payload
  }, playerOrigin);
  return id;
}
window.addEventListener('message', event => {
  if (event.origin !== playerOrigin || event.source !== frame.contentWindow) return;
  const result = event.data;
  if (result?.channel !== 'ideal-study' || result.version !== 1) return;
  if (!result.ok) console.error(result.error);
  // result.id 对应请求；成功时附 state 与最新 project。
});

// 在就绪后调用，可绑定到你自己的产品按钮：
command('setMood', 'night');
command('setMaterial', { id: 'desk-1', material: 'walnut' });
command('seek', 4.8);
command('play');
// command('loadProject', await response.json());
// command('pause'); command('getState');
```

消息接口目前支持 `loadProject`、`setMood`、`setMaterial`、`seek`、`play`、`pause`、`getState`。没有家具任意增删的远程命令；这类操作可先在编辑器完成，或在源码中扩展并继续调用模型验证函数。`setMaterial` 使用工程中实际存在的物件 id，不能假定所有导入工程都有 `desk-1`。

默认只接受**同源父窗口**。跨域接入时，在 `src/embed.ts` 的 `allowedParentOrigins` 中加入宿主的准确 HTTPS origin，重新构建；宿主也须校验来源与窗口，不使用 `*`。这基于浏览器的 [postMessage 机制](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)。接入真实业务时，工程由宿主传入；示例不读取、写入或上传用户本地存档。

## 深度接入：直接使用源码 API

适合已有 React、Vue 或其他 Vite / TypeScript 项目，希望自己设计全部界面的情况。复制 `src/player.ts`、`scene.ts`、`model.ts`、`geometry.ts`、`photos.ts`、`film-model.ts`、`portfolio-model.ts`、`hotspots.ts` 和 `portfolio.css` 到同一模块目录，保持相对导入。若保留 `StudyScene.exportGLB`，同时复制 `model-export.ts`。新增作品事件接口见 [PORTFOLIO.md](PORTFOLIO.md)。

本次验证依赖 `three@0.180.0` 与开发类型 `@types/three@0.180.0`。单独播放器不依赖 Lucide 或 Mediabunny；集成视频编码功能才需要后者。保留仓库中的第三方许可说明。

```ts
import { createStudyPlayer } from './study/player';

const host = document.querySelector<HTMLElement>('#room')!;
// 容器须有明确大小，16:9 可保持短片构图；其他比例按实际视口投影。
host.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;overflow:hidden';
const project = await fetch('/assets/my-study.json').then(r => {
  if (!r.ok) throw new Error('工程加载失败');
  return r.json();
});
const player = await createStudyPlayer(host, project);
player.setMood('night');
player.setMaterial('desk-1', 'walnut');
player.seek(4.8);
player.play();

// 产品自行决定保存位置，播放器不冒充云存储。
const updated = player.getProject();
// 组件卸载时调用；React/Vue 的异步挂载完成后也要检查是否已卸载。
// player.destroy();
```

实现的 API：`loadProject`（异步验证、解码照片）、`setMood`、`setMaterial`、`seek`、`play`、`pause`、`getProject`、`getState`、`destroy`。返回的工程为副本，避免外部直接修改内部数据。播放器复用 `StudyScene` 与 `sampleFilm`，没有另造展示房间或播放轨迹。`seek` 会暂停并定位到 30 fps 的同一采样规则；手动旋转只是观察，不改写镜头关键帧。

这是本仓库内的源码 API，**不是已经发布到 npm 的 SDK**。React / Vue 及其他具体产品的生产集成还需在目标项目中验收。多实例负载、原生 App WebView、Unity、Unreal、Blender 的导入未在本轮实机验证。

## GLB 用于模型交换

房间顶部「导出」提供整屋和选中物件 GLB。选中物件导出时恢复局部原点与正向；整屋保留布置位置。米制、Y 轴向上，包含几何、基础材质、颜色贴图和照片，贴图嵌入文件。重复网格展开为普通 Mesh，接收端无需 GPU instancing 扩展。基于 [Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)，本轮未新增模型导出依赖。

`src/glb-viewer.ts` 只使用 GLTFLoader 和普通场景灯光，**不导入 geometry.ts 或 StudyScene**。可在里面打开实际文件确认模型独立性。第三方网页的最小加载代码：

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const asset = await new GLTFLoader().loadAsync('/assets/study-room.glb');
scene.add(asset.scene); // scene、camera、renderer 与照明由你的产品创建。
```

部署到子目录时，资源地址需要带正确 base path；本项目提供 `npm run build:pages` 测试仓库子路径。导出时的 `userData.itemId` 会随 glTF extras 保存，便于接收端关联业务编号。

GLB 不携带本应用的撤销历史、编辑器、时间轴逻辑、SSAO、阴影配置或色调映射；本版本也不将短片编译成 glTF 相机动画。木纹 / 织物的 bump 细节没有导出。目标引擎需设置灯光、相机与渲染方式，因此无法保证跨软件逐像素一致。希望保持当前视觉风格与镜头节奏时，优先复用源码播放器和工程 JSON。

## 历史家具版本的数据变更（v2 房间 / v3 短片）

以下记录上一轮迁移；当前作品版本升级为房间 v3 / 短片 v4，新增部位标识、作品内容与绑定，保存键和迁移规则以 [PORTFOLIO.md](PORTFOLIO.md) 为准。

- 11 类可选物件，默认 9 件：原 8 件家具配饰与从固定装饰迁移出的相框。沙发与床按需添加，添加位置避开现有家具；手工移动沿用房间边界限制，不提供完整家具碰撞求解。
- 墙面相框只支持背墙，最多 3 个。宽 0.4–1.8 m、高 0.3–1.2 m，水平位置与中心高度受墙面限制。上传 JPG / PNG / WebP ≤8 MB、边长≤8192，规范化为最长边≤1024 的 JPEG，每张编码字符串≤450,000 字符，保留照片比例并留白。照片存于工程内，换浏览器导入无需另找原图。当前不支持透明 PNG 保留透明度、裁剪工具或墙体编辑。
- 房间输出 `app: ideal-study, version: 2`，保存键 `ideal-study.plan.v2`；先读取新存档，再回退读取 v1。v1 家具和镜头值保持；新增原固定画框为可编辑物件。旧方案已满 40 件时不补入画框，以保留全部原物件。
- 短片输出 `app: ideal-study-film, version: 3`，`scene.version: 2`，`film.version: 1`；保存键 `ideal-study.film.v3`。可读旧短片 v2、房间 v1/v2，旧存储键不写入、不删除。内嵌照片解码成功后才接受导入；错误保留当前工程与历史。
- 存储仍受浏览器配额限制，失败时明确提示导出 JSON 备份。不同网站的本地存储不会自动共享，[localStorage 按 origin 隔离](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)。

实际操作与环境记录见 [REUSE-VALIDATION.md](REUSE-VALIDATION.md)。
