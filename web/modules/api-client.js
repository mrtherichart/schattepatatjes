// Transport boundary: PHP server URL is independent of current HTML/Android origin.
export function createApiClient({apiAddress, recordConnection, errorAdvice}) {
async function api(action,options={}){
 const params=new URLSearchParams({action,...(options.query||{})});
 const started=performance.now();
 let response;
 try{
  response=await fetch(`${apiAddress}?${params}`,{
   method:options.body?'POST':'GET',headers:options.body?{'Content-Type':'application/json'}:undefined,
   credentials:'same-origin',body:options.body?JSON.stringify(options.body):undefined,
   cache:'no-store',signal:AbortSignal.timeout(10000)
  });
 }catch(cause){
  const message=cause.name==='TimeoutError'?'De server reageert niet binnen 10 seconden.':'Geen contact met de server. Controleer internet en het API-adres.';
  const e=Object.assign(Error(message),{status:0});
  recordConnection(false,{status:0,error:message,latency:performance.now()-started});
  throw e;
 }
 const elapsed=performance.now()-started;
 const jsonType=(response.headers.get('content-type')||'').includes('application/json');
 let body=null;
 if(jsonType){try{body=await response.json();}catch{/* handled below */}}
 if(!body||typeof body!=='object'){
  const message=errorAdvice(response.status,false);
  const e=Object.assign(Error(message),{status:response.status});
  recordConnection(false,{status:response.status,error:message,latency:elapsed});
  throw e;
 }
 if(!response.ok||body.ok===false){
  const message=body.message||errorAdvice(response.status,true);
  const e=Object.assign(Error(message),{status:response.status,body});
  recordConnection(false,{status:response.status,error:response.status===404&&body.message==='Onbekende actie.'?errorAdvice(404,true):message,latency:elapsed});
  throw e;
 }
 if(action==='health' && body.service!=='schattepatatjes-api'){
  const message='Onverwachte API. Controleer of Schattepatatjes op de juiste server staat.';
  recordConnection(false,{status:response.status,error:message,latency:elapsed});
  throw Object.assign(Error(message),{status:response.status});
 }
 recordConnection(true,{status:response.status,result:body,latency:elapsed});
 return body;
}

return api;
}
