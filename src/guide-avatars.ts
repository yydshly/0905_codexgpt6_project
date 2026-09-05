import definitions from './assets/guide/avatars.json';

/** Immutable identity -> local asset. Shared by validation, editor and publisher. */
export const guideAvatars = definitions;
export type GuideAvatarId = keyof typeof guideAvatars;
export const DEFAULT_GUIDE_AVATAR: GuideAvatarId = 'personal-creator-01-v1';
export function isGuideAvatarId(id: unknown): id is GuideAvatarId {
  return typeof id === 'string' && Object.hasOwn(guideAvatars, id);
}
