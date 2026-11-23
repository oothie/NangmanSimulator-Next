/* Shared importer. Legacy files stay local; protected .sbj files require validation. */
(function(root){'use strict';
 const LEGACY_MAX=24*1024*1024,PRIVATE_MAX=LEGACY_MAX+65536;
 const MAGIC=[83,66,74,65,82,67,72,0];
 const scriptURL=document.currentScript?.src||new URL('/suanbujin/shared/save_file.js',location.href).href;
 let loginAssets;
 function changed(){return Object.assign(Error('账号已变更，请重新导入'),{code:'account_changed',cancelled:true});}
 function state(){try{if(root.parent!==root&&root.parent.SBJAccountState)return root.parent.SBJAccountState;}catch(e){}return root.SBJAccountState;}
 function assertCurrent(owner,token){if(owner?.current&&!owner.current(token))throw changed();}
 function cloudLogin(){
  if(root.SBJCloud?.login)return Promise.resolve(root.SBJCloud);
  if(!loginAssets)loginAssets=new Promise((resolve,reject)=>{
   const script=document.createElement('script'),url=new URL('cloud_items.js',scriptURL);url.search=new URL(scriptURL).search;
   const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else if(root.SBJCloud?.login)resolve(root.SBJCloud);else reject(Error('登录界面未加载完成，请重试'));};
   const timer=setTimeout(()=>finish(Error('登录界面加载超时，请重试')),15000);
   script.src=url.href;script.onload=()=>finish();script.onerror=()=>finish(Error('登录界面未加载完成，请重试'));document.head.append(script);
  }).catch(error=>{loginAssets=null;throw error;});
  return loginAssets;
 }
 async function browserOpen(bytes){
  const owner=state(),token=owner?.begin?.('archive-open'),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);let response,value;
  try{
   if (typeof location !== 'undefined' && /(^|\.)(pages\.dev|github\.io)$/.test(location.hostname)) throw Error('공개 시뮬레이터에서는 세이브를 원격 검증 서버로 전송하지 않습니다.');
   response=await fetch('/api/feilong/v1/cloud/archive-open',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/octet-stream'},body:bytes,signal:controller.signal});
   value=await response.json();
  }catch(error){assertCurrent(owner,token);throw Error(error.name==='AbortError'?'存档验证超时，请重试':'暂时无法验证存档，请检查网络后重试');}
  finally{clearTimeout(timer);}
  assertCurrent(owner,token);
  if(!response.ok||!value?.ok){
   const code=value?.error;
   if(code==='cloud_login_required')owner?.clear?.(token);
   const messages={cloud_login_required:'请先登录后导入',invalid_private_archive:'存档已损坏或不是有效的算不尽存档',unsupported_private_archive:'此存档需要更新工具后导入',file_too_large:'文件过大',rate_limited:'操作较频繁，请稍后重试'};
   throw Object.assign(Error(messages[code]||'存档验证未完成，请重试'),{code});
  }
  return value;
 }
 async function openPrivate(bytes,authorization){
  let value;
  if(typeof authorization?.openPrivateArchive==='function')value=await authorization.openPrivateArchive(bytes);
  else if(typeof root.SBJPrivateArchive?.open==='function')value=await root.SBJPrivateArchive.open(bytes);
  else{
   try{value=await browserOpen(bytes);}catch(error){
    if(error.code!=='cloud_login_required')throw error;
    const cloud=await cloudLogin();await cloud.login();value=await browserOpen(bytes);
   }
  }
  if(!value?.save||typeof value.save!=='object'||Array.isArray(value.save))throw Error('存档内容不完整，请重新导出');
  const meta=value.meta||{};
  return {data:value.save,format:'sbj',platform:String(meta.platform||''),channel:String(meta.channel||''),version:String(meta.version||'')};
 }
 root.readSaveImport=async function(file,authorization){
  if(!file||typeof file.arrayBuffer!=='function')throw Error('请选择存档文件');
  if(!file.size||file.size>PRIVATE_MAX)throw Error(file.size?'文件过大':'存档文件为空');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(MAGIC.every((byte,i)=>bytes[i]===byte))return openPrivate(bytes,authorization);
  if(/\.sbj$/i.test(file.name||''))throw Error('存档已损坏或不是有效的算不尽存档');
  if(bytes.length>LEGACY_MAX)throw Error('文件过大');
  const text=new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/,'').trim();
  if(text.startsWith('{')||text.startsWith('[')||/\.json$/i.test(file.name||'')){
   let data;try{data=JSON.parse(text);}catch(e){throw Error('存档内容不是有效数据，请重新选择文件');}
   if(data&&data.data&&!data.MainRole)data=data.data;
   return {data:data,format:'json'};
  }
  if(typeof decryptSaveFile!=='function')throw Error('存档读取组件尚未就绪，请刷新后重试');
  return decryptSaveFile(file,'auto',authorization||{});
 };
})(window);
