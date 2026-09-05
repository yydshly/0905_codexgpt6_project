const workspace = new URLSearchParams(location.search).get('workspace');
if (workspace === 'room') void import('./room-editor');
else void import('./studio');
