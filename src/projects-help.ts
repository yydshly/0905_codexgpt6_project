import './projects-help.css';
import { productRoadmapDescription } from './product-roadmap';

/** Read-only help; creating a project delegates to the existing authoring flow. */
export function mountProjectsHelp(header:HTMLElement,startNew:()=>void,canStart:()=>boolean){
  const actions=document.createElement('nav');actions.className='projects-header-actions';actions.setAttribute('aria-label','工程库帮助与导航');
  const entry=document.createElement('button');entry.id='projects-help';entry.className='project-action quiet';entry.type='button';entry.setAttribute('aria-haspopup','dialog');entry.innerHTML='<span class="help-question" aria-hidden="true">?</span>使用帮助';
  const quick=header.querySelector('a');actions.append(entry);if(quick)actions.append(quick);header.append(actions);
  entry.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='project-manager-dialog project-help';dialog.setAttribute('aria-labelledby','projects-help-title');dialog.setAttribute('aria-describedby','projects-help-intro');
    dialog.innerHTML=`<header class="help-heading"><div><span class="project-overline">A LITTLE GUIDANCE</span><h2 id="projects-help-title">理想书房 · 使用指南</h2></div><button type="button" class="help-close" aria-label="关闭使用帮助" autofocus>×</button></header>
      <div class="help-body"><p id="projects-help-intro">一套<strong>工程</strong>包含房间、短片镜头和展示页设置；一个<strong>作品</strong>是关联到物品的项目介绍与网页链接。你可以同时保留多套未完成工程。</p>
      <p class="help-path">新建工程 <span>→</span> 布置与关联 <span>→</span> 保存 <span>→</span> 作品展示 <span>→</span> 导出部署</p>
      <details><summary>后续规划 · 尚未实现</summary><div class="help-answer">${productRoadmapDescription}</div></details>
      <details open><summary>第一次使用，从哪里开始？</summary><div class="help-answer"><ol><li>点击工程库的「新建工程」，填写名称，进入已经布置好的书房。</li><li>在同一工程中，通过顶部「1 布置书房」「2 镜头短片」「3 作品展示」切换工作内容。</li><li>暂时没做完也可以保存。右上「我的工程」→「保存并返回工程库」，下次从卡片继续。</li></ol><p class="help-note"><strong>工程库和快速工作区：</strong>管理多套方案请从工程库进入。「快速工作区」保留旧版房间、短片各一份存档；仅修改名称并保存，不会自动另存为新工程。它的新保存会在进入工程库时迁入，相同内容会去重。</p></div></details>
      <details><summary>怎样切换、复制或删除工程？</summary><div class="help-answer"><dl><dt>切换</dt><dd>当前页面右上「我的工程」可选「保存并返回工程库」或「不保存，返回工程库」。不保存时，有修改会先询问是否放弃；已保存的内容与版本不变。返回后再打开另一张卡片。</dd><dt>复制已保存内容</dt><dd>工程卡片上的「复制工程」。副本独立保存，从版本 1 开始。</dd><dt>保留当前修改，尝试新方向</dt><dd>编辑器右上「我的工程」→ 填写新名称 →「另存为新工程」。当前未保存内容也会进入副本，原工程保持原样。</dd><dt>删除不需要的工程</dt><dd>卡片底部「删除工程」，确认后删除这套工程和全部保存版本，无法撤销。可先下载当前 JSON 备份；其他工程、快速工作区存档和已发布网站不受影响。</dd></dl></div></details>
      <details><summary>怎样布置房间和调整镜头？</summary><div class="help-answer"><p>左侧物件库点击添加；点击场景中的物品或右侧物件列表选中它。拖动物品移动，右侧调整位置、朝向、材质及灯具亮度。底部切换白昼、黄昏、深夜。</p><p>切到「观察」后拖动旋转视角，滚轮缩放；也可右键拖动观察。「恢复默认视角」可回到初始构图。</p><p class="help-note"><kbd>Ctrl / ⌘ + S</kbd> 保存 · <kbd>Ctrl / ⌘ + Z</kbd> 撤销 · <kbd>Ctrl / ⌘ + Shift + Z</kbd> 重做。页面顶部也有对应按钮。</p></div></details>
      <details><summary>怎样让物品关联自己的作品？</summary><div class="help-answer"><ol><li>选中物品，在右侧「作品入口」点击「关联我的作品」。</li><li>选择「新建作品」或已有作品，填写名称、完整的 http:// 或 https:// 链接，可补充简介、标签与封面，再点「应用关联」。</li><li>通过顶部「3 作品展示」预览；点击物品或下方作品卡片查看详情，再点「访问项目」。</li></ol><p>11 类可选物件都支持关联。书桌与显示器还可选择整体或书籍/屏幕部位；每个入口关联一个作品，同一作品可用于多个入口，每套工程最多 40 个作品。</p><p class="help-note">修改已有作品，会同步到它在这套工程中的其他入口。墙体、窗户和书架内部每一本书暂不是独立入口。</p></div></details>
      <details><summary>怎样制作和导出短片？</summary><div class="help-answer"><p>打开「2 镜头短片」，选择镜头段，在右侧设置起点、终点、观察目标、时长和顺序。底部可播放、暂停或拖动播放头，最多支持 3 段镜头。</p><p>「保存工程」保留镜头数据；「导出视频」会检测浏览器实际支持的格式，生成后可以回放检查和下载。当前视频为无音轨的 1280×720、30fps，编码需要支持该能力的桌面浏览器及 HTTPS 或本机地址。</p></div></details>
      <details><summary>怎样找回以前保存的版本？</summary><div class="help-answer"><p>在工程卡片点击「保存版本」，找到需要的版本 →「恢复此版本」→「确认恢复」。也可以从编辑器「我的工程」→「保存并查看版本」进入。</p><p>有内容变化的保存会留下新版本；恢复旧内容会追加一个版本，恢复前的版本仍然保留，可以再次找回。</p><p class="help-note"><strong>保存版本与撤销不同：</strong>保存版本可跨刷新恢复；每次拖动、修改对应的撤销记录只保留在当前编辑会话。重要修改完成后记得保存。</p></div></details>
      <details><summary>怎样备份、发布，或接入其他产品？</summary><div class="help-answer"><dl><dt>以后继续编辑 · JSON</dt><dd>工程卡片「备份 JSON」带走当前完整工程。用「导入 JSON 为新工程」重新打开；文件不含整套历史版本库。</dd><dt>发布个人展示网站 · ZIP</dt><dd>工程卡片「作品展示」→「发布展示页」，设置个人介绍后点击「下载网站 ZIP」。解压并上传到 GitHub Pages 或其他静态网站服务，部署后才有公开网址。更新内容需重新导出并部署。</dd><dt>接入模型或媒体 · GLB / PNG / 视频</dt><dd>布置页面「导出」可生成模型 GLB 和 PNG；短片页面导出视频。GLB 若要保留作品点击行为，还需配合对应 JSON 和网页交互代码，可查看作者展示页的「网页接入」示例。PNG 与视频不携带点击行为。</dd></dl><p class="help-note">工程与版本仅存于当前浏览器、当前网站地址。换浏览器或设备请用 JSON 迁移；清除网站数据会影响本地存档。发布后房间照片与已关联作品公开可见。</p></div></details>
      </div><footer class="help-footer"><span>随时从工程库顶部打开这份指南。</span><button type="button" class="project-action quiet" data-help-done>返回工程库</button><button type="button" class="project-action primary" data-help-new>开始新建工程</button></footer>`;
    let create=false;
    const newButton=dialog.querySelector<HTMLButtonElement>('[data-help-new]')!;newButton.disabled=!canStart();if(newButton.disabled)newButton.textContent='工程库暂不可用';
    dialog.querySelector('.help-close')!.addEventListener('click',()=>dialog.close());dialog.querySelector('[data-help-done]')!.addEventListener('click',()=>dialog.close());
    dialog.querySelector('[data-help-new]')!.addEventListener('click',()=>{create=true;dialog.close();});
    dialog.addEventListener('close',()=>{dialog.remove();entry.focus({preventScroll:true});if(create)startNew();},{once:true});
    document.body.append(dialog);dialog.showModal();
  };
}
