import { getProject, saveProject, projectURL } from './project-store';
import type { FilmProject } from './film-model';
export async function projectSession(){
  const id=new URLSearchParams(location.search).get('id');if(!id)return null;
  let record=await getProject(id);
  return {get record(){return record;},url:(workspace:'room'|'film'|'portfolio')=>projectURL(workspace,id),async save(project:FilmProject,thumbnail?:string){record=await saveProject(id,record.revision,project,thumbnail);return record;}};
}
