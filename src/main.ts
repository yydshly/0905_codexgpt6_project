const workspace = new URLSearchParams(location.search).get('workspace') ?? 'film';
// Separate loader functions retain each route's CSS dependency list in Vite builds.
const routes:Record<string,()=>Promise<unknown>>={
  room:()=>import('./room-editor'),
  film:()=>import('./studio'),
  viewer:()=>import('./glb-viewer'),
  embed:()=>import('./embed'),
  integration:()=>import('./integration'),
  portfolio:()=>import('./portfolio'),
  projects:()=>import('./projects'),
};
void (Object.hasOwn(routes,workspace)?routes[workspace]:routes.film)().catch(error=>{
  const app=document.querySelector('#app');if(app){app.replaceChildren();const message=document.createElement('p'),link=document.createElement('a');message.textContent='页面无法打开：'+(error as Error).message;link.textContent='返回我的工程';link.href='?workspace=projects';app.append(message,link);}console.error(error);
});
