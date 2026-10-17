export class ApiError extends Error {
 constructor(code,status,details={}){super(code);this.code=code;this.status=status;this.details=details;}
}
export function createTransport(endpoint='/sp/api.php',fetcher=globalThis.fetch.bind(globalThis)) {
 let csrf='';
 async function request(route,body,again=true){
  const url=new URL(endpoint,globalThis.location?.href||'http://localhost');url.searchParams.set('action','foundation');url.searchParams.set('route',route);
  const multipart=typeof FormData!=='undefined'&&body instanceof FormData;
  const headers=body?{'X-CSRF-Token':csrf,...(!multipart?{'Content-Type':'application/json'}:{})}:{};
  const response=await fetcher(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers,body:body?(multipart?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(25000)});
  let result;try{result=await response.json();}catch{throw new ApiError('INVALID_RESPONSE',response.status);}
  if(!response.ok||result?.ok!==true){
   const code=result?.error?.code||'SERVER_ERROR';
   if(code==='CSRF_INVALID'&&again){await request('bootstrap');return request(route,body,false);}
   throw new ApiError(code,response.status,result?.error?.details);
  }
  if(result.apiVersion!==2||!result.data||typeof result.data!=='object')throw new ApiError('PROTOCOL_MISMATCH',502);
  if(route==='bootstrap'||route==='login'){
   if(typeof result.data.csrfToken!=='string')throw new ApiError('INVALID_RESPONSE',502);
   csrf=result.data.csrfToken;
  }
  if(route==='state')validateSnapshot(result.data);
  return result.data;
 }
 return {request,mediaUrl(id,thumbnail=false){const url=new URL(endpoint,globalThis.location?.href||'http://localhost');url.search=new URLSearchParams({action:'foundation',route:'media',id,...(thumbnail?{thumbnail:'1'}:{})}).toString();return url.href;}};
}
export function validateSnapshot(s){
 if(s?.schemaVersion!==2||!Number.isSafeInteger(s.revision)||s.revision<1||typeof s.records!=='object'||!s.records||Array.isArray(s.records))throw new ApiError('INVALID_SNAPSHOT',502);
 for(const [key,r] of Object.entries(s.records))if(!r||typeof r.id!=='string'||typeof r.kind!=='string'||key!==`${r.kind}:${r.id}`||!Number.isSafeInteger(r.version)||r.version<1||typeof r.deleted!=='boolean'||typeof r.data!=='object'||!r.data)throw new ApiError('INVALID_SNAPSHOT',502);
 return s;
}
