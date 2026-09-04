# 资产与代码来源

本项目没有使用外部房间效果图、视频、HDRI、家具模型或素材站下载的贴图来充当可编辑场景。

| 内容 | 来源及制作方式 | 修改 / 授权说明 |
|---|---|---|
| 书桌、椅子、显示器、书架、台灯、落地灯、植物、地毯 | `src/geometry.ts` 的程序几何组合；在本项目中自行制作 | 非外部模型，不涉及模型资源下载或再许可 |
| 房间地台、墙壁、真实窗洞、窗框、窗帘、踢脚线 | 本项目程序几何 | 固定建筑结构；与家具使用同一 Three.js 场景 |
| 书籍、杯子、键盘、花瓶、画框、显示器屏幕图形 | 本项目几何制作 | 固定在所属家具/墙壁上的视觉细节；不作为独立物件提供编辑 |
| 木纹、织物 | 本项目通过 Canvas 绘制确定性程序纹理，再用于真实几何的 PBR 材质 | 不是房间背景或场景截图 |
| 物件库 / 选中物件缩略图 | 用相同家具工厂在临时 Three.js 场景中渲染生成 | 各支持材质均有对应缩略图；临时预览不替代主场景 |
| 品牌标志及 favicon | 自行制作的线框立方体 SVG | 项目内源文件 |
| Three.js 0.180.0 | [threejs.org](https://threejs.org/)，[官方源码](https://github.com/mrdoob/three.js/tree/r180) | MIT；包含 OrbitControls、RoundedBoxGeometry、SSAO、SMAA 的成熟实现与抗锯齿查找纹理；没有修改依赖源文件 |
| Lucide 0.468.0 图标 | [lucide.dev](https://lucide.dev/)，[官方源码](https://github.com/lucide-icons/lucide) | ISC；部分源于 MIT 授权的 Feather。项目仅使用所需图标并设定大小/线宽 |
| 中文与拉丁字体 | 用户设备已安装的系统字体，优先 Noto Sans SC / Microsoft YaHei | 不分发外部字体文件，不发起 Google Fonts 请求 |
| 产品截图与导出图片 | Playwright 控制真实 Chrome，实际运行本应用后生成 | 见 `docs/evidence`，不可替代实际操作测试 |

外部模型修改项：无。引擎、后处理算法、图标库的质量归属于各自作者；本项目的工作是程序场景制作、产品设计与功能集成。

第三方依赖原始许可证见根目录 `THIRD_PARTY_LICENSES.txt`；版本固定在 `package-lock.json`。
