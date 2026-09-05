import './workspace-nav.css';

export function workspaceNav(active: 'room' | 'film', linked = true) {
  return `<nav class="workspace-nav" aria-label="工作区切换">
    ${active === 'room' ? '<span aria-current="page"><b>1</b>布置书房</span>' : '<button id="workspace-room" title="保存当前工程并布置书房"><b>1</b>布置书房</button>'}
    ${active === 'film' ? '<span aria-current="page"><b>2</b>镜头短片</span>' : `<button id="workspace-film" title="保存房间后进入短片工作台"><b>2</b>${linked ? '返回短片工作台' : '打开短片工作台'}</button>`}
    <button id="workspace-portfolio" title="保存工程并预览可点击的作品书房"><b>3</b>作品展示</button>
  </nav>`;
}
