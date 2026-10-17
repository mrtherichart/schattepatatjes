// The old shell is available only to finish legacy queued changes before migration.
if(new URLSearchParams(location.search).get('legacy')==='1')await import('../app.js');
else await import('./foundation/bootstrap.js');
