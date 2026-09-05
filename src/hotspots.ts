import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { activation, sameTarget, targetKey, targetLabel, type ContentTarget, type Portfolio, type WorkActivation } from './portfolio-model';
import './portfolio.css';

/** DOM signs and actual surface picking share the exact same persistent target IDs. */
export interface ContentSurface {
  renderer:{domElement:HTMLCanvasElement}; controls:OrbitControls;
  contentTargetAt(x:number,y:number):ContentTarget|null;
  contentAnchors():Array<{target:ContentTarget;x:number;y:number;visible:boolean}>;
}
export function mountHotspots(host:HTMLElement,scene:ContentSurface,getPortfolio:()=>Portfolio,onActivate:(event:WorkActivation)=>void) {
  const layer=document.createElement('div');layer.className='study-hotspots';layer.setAttribute('aria-label','空间中的作品入口');host.append(layer);
  const canvas=scene.renderer.domElement;let enabled=true,disposed=false,markers=true;
  let down:{id:number;x:number;y:number;target:ContentTarget|null;moved:boolean}|null=null;
  function activate(t:ContentTarget){if(!enabled)return;const event=activation(getPortfolio(),t);if(event)onActivate(event);}
  function position(){if(disposed)return;for(const a of scene.contentAnchors()){const b=[...layer.querySelectorAll<HTMLButtonElement>('button')].find(el=>el.dataset.target===targetKey(a.target));if(b){b.hidden=!enabled||!a.visible;b.style.left=a.x+'px';b.style.top=a.y+'px';}}}
  function refresh(){
    layer.replaceChildren();getPortfolio().bindings.forEach((b,i)=>{
      const work=activation(getPortfolio(),b.target)?.project;if(!work)return;
      const button=document.createElement('button');button.type='button';button.dataset.target=targetKey(b.target);button.className='study-hotspot';button.setAttribute('aria-label',`${targetLabel(b.target)}：${work.title}`);
      const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.className='hotspot-title';label.textContent=work.title;button.append(number,label);button.onclick=()=>activate(b.target);layer.append(button);
    });position();
  }
  const pointerdown=(e:PointerEvent)=>{if(e.button!==0||!enabled)return;if(down){down.moved=true;return;}down={id:e.pointerId,x:e.clientX,y:e.clientY,target:scene.contentTargetAt(e.clientX,e.clientY),moved:false};};
  const pointermove=(e:PointerEvent)=>{
    if(down){if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)down.moved=true;return;}
    if(!enabled||e.buttons)return;const t=scene.contentTargetAt(e.clientX,e.clientY),bound=t&&activation(getPortfolio(),t);canvas.style.cursor=bound?'pointer':'grab';
    layer.querySelectorAll<HTMLElement>('button').forEach(b=>b.classList.toggle('is-hovered',!!bound&&b.dataset.target===targetKey(t!)));
  };
  const pointerup=(e:PointerEvent)=>{const d=down;down=null;if(!d||d.id!==e.pointerId||d.moved||!d.target)return;const t=scene.contentTargetAt(e.clientX,e.clientY);if(t&&sameTarget(t,d.target))activate(t);};
  const cancel=()=>{down=null;};
  canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointermove',pointermove);canvas.addEventListener('pointerup',pointerup);canvas.addEventListener('pointercancel',cancel);
  scene.controls.addEventListener('change',position);const observer=new ResizeObserver(position);observer.observe(host);refresh();
  return {refresh,setMarkersVisible(value:boolean){markers=value;layer.hidden=!enabled||!markers;},setEnabled(value:boolean){enabled=value;down=null;layer.hidden=!value||!markers;position();},destroy(){disposed=true;observer.disconnect();scene.controls.removeEventListener('change',position);canvas.removeEventListener('pointerdown',pointerdown);canvas.removeEventListener('pointermove',pointermove);canvas.removeEventListener('pointerup',pointerup);canvas.removeEventListener('pointercancel',cancel);layer.remove();}};
}
