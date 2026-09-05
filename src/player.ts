import { StudyScene } from './scene';
import { clone, MATERIALS, CATALOG, type Mood } from './model';
import { createFilmProject, parseFilmProject, sampleFilm, totalDuration, FPS } from './film-model';
import { preparePhotos } from './photos';
import { mountHotspots } from './hotspots';
import type { WorkActivation } from './portfolio-model';

/** Source integration API. Give the host an explicit size; call destroy on unmount. */
export async function createStudyPlayer(host:HTMLElement,initial:unknown=createFilmProject()) {
  let project=parseFilmProject(initial).project,playing=false,frame=0,start=0,offset=0,disposed=false,revision=0;
  const listeners=new Set<(event:WorkActivation)=>void>();
  let hotspots:ReturnType<typeof mountHotspots>|undefined;
  await preparePhotos(project.scene);
  const scene=new StudyScene(host,{select:()=>{},begin:()=>{},move:()=>{},end:()=>{},camera:()=>{},error:message=>host.dispatchEvent(new CustomEvent('study-error',{detail:message}))});
  scene.setMode('orbit');scene.setFraming(null);
  const active=()=>{if(disposed)throw new Error('播放器已销毁。');};
  const draw=(time:number)=>{project.playhead=sampleFilm(project,time).time;scene.applyCamera(sampleFilm(project,project.playhead).camera);};
  const pause=()=>{playing=false;cancelAnimationFrame(frame);scene.setInteractionEnabled(true);hotspots?.setEnabled(true);};
  const render=()=>{scene.sync({...project.scene,selectedId:null});draw(project.playhead);hotspots?.refresh();};
  const tick=(now:number)=>{if(!playing)return;const time=offset+(now-start)/1000;draw(Math.floor(time*FPS)/FPS);if(time>=totalDuration(project)){pause();return;}frame=requestAnimationFrame(tick);};
  render();
  hotspots=mountHotspots(host,scene,()=>project.scene.portfolio,event=>{pause();listeners.forEach(listener=>listener(structuredClone(event)));});
  return {
    async loadProject(raw:unknown){active();const token=++revision,next=parseFilmProject(raw).project;await preparePhotos(next.scene);active();if(token!==revision)return;pause();project=next;render();},
    setMood(mood:Mood){active();if(!['day','dusk','night'].includes(mood))throw new Error('未知光照预设。');project.scene.mood=mood;scene.sync({...project.scene,selectedId:null});},
    setMaterial(id:string,value:string){active();const item=project.scene.objects.find(o=>o.id===id);if(!item||!Object.hasOwn(MATERIALS,value)||!CATALOG[item.kind].materials.includes(value))throw new Error('物件或材质不受支持。');item.material=value;scene.sync({...project.scene,selectedId:null});hotspots?.refresh();},
    seek(seconds:number){active();if(!Number.isFinite(seconds)||seconds<0||seconds>totalDuration(project))throw new Error('播放位置超出短片范围。');pause();draw(seconds);},
    play(){active();pause();if(project.playhead>=totalDuration(project))draw(0);playing=true;scene.setInteractionEnabled(false);hotspots?.setEnabled(false);offset=project.playhead;start=performance.now();frame=requestAnimationFrame(tick);},
    pause,
    resetView(){active();pause();scene.view('default');},
    setMarkersVisible(value:boolean){active();if(typeof value!=='boolean')throw new Error('标记显示状态须为布尔值。');hotspots?.setMarkersVisible(value);},
    getProject(){active();return clone(project);},
    getState(){active();return {playing,time:project.playhead,duration:totalDuration(project)};},
    onActivate(listener:(event:WorkActivation)=>void){active();listeners.add(listener);return ()=>{listeners.delete(listener);};},
    getMetrics(){active();return scene.getMetrics();},
    destroy(){if(disposed)return;pause();disposed=true;revision++;listeners.clear();hotspots?.destroy();scene.destroy();},
  };
}
