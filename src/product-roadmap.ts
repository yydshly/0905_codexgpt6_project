/** Static author-facing roadmap; it does not enable features or change project data. */
export const productRoadmapDescription = `
  <p><strong>规划中 · 暂缓实施</strong>（2026-09-06）。以下是后续方向，尚未实现，也没有确定交付日期。</p>
  <p><strong>当前状态：</strong>房间工程包含房间、短片和作品展示设置；角色仍在独立导览中配置与保存，不会自动写回房间工程。</p>
  <ol>
    <li><strong>优先：统一工程与历史。</strong>让房间、作品关联、角色和动作一起保存、复制、恢复与 JSON 备份，兼容旧工程和独立导览。</li>
    <li><strong>随后：在场景中配置行为。</strong>通过点击设置角色起点、朝向、行走目标、停留与座椅，预览与导出共用配置。</li>
    <li><strong>再完善：发布前预览。</strong>集中检查访客画面、作品链接和角色动作，明确区分未保存、已保存与待重新发布的内容。</li>
    <li><strong>后续评估：角色素材升级。</strong>制定自定义模型、骨骼、动作与表情的接入规范，逐项验收造型、运动、授权与网页性能。</li>
  </ol>
  <p>目前请分别保存房间工程和导览；导览跨设备编辑使用自己的导览 JSON，公开展示需部署导出的网站包。快照地址不是跨设备分享链接。</p>
`;
