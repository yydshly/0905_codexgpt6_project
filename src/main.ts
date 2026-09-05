const workspace = new URLSearchParams(location.search).get('workspace') ?? 'film';
// Separate loader functions retain each route's CSS dependency list in Vite builds.
const routes:Record<string,()=>Promise<unknown>>={
  room:()=>import('./room-editor'),
  film:()=>import('./studio'),
  viewer:()=>import('./glb-viewer'),
  embed:()=>import('./embed'),
  integration:()=>import('./integration'),
  portfolio:()=>import('./portfolio'),
};
void (Object.hasOwn(routes,workspace)?routes[workspace]:routes.film)().catch(error=>{
  const app=document.querySelector('#app');if(app)app.textContent='页面加载失败，请刷新重试。';console.error(error);
});
