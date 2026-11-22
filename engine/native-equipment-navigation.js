/* Same-origin direct equipment routes; no nested iframe or duplicate integrated site. */
(() => {
  const PATHS={
    quick:'/vendor/sanbujin/equip-quick/index.html',
    auto:'/vendor/sanbujin/equip-auto/index.html',
    manual:'/vendor/sanbujin/equip/index.html',
    orange:'/vendor/sanbujin/equip-orange/index.html',
    jianwang:'/vendor/sanbujin/jianwang-manual/index.html',
    jianwangAuto:'/vendor/sanbujin/jianwang-auto/index.html'
  };
  const current=Object.keys(PATHS).find(k=>location.pathname===PATHS[k])||'manual';
  const main=[
    ['세수','/#wash'],['장비',PATHS.quick],['캐릭터','/#character'],
    ['백과','/#wiki'],['일일','/#daily'],['드랍','/#drop'],
    ['임무','/#quest'],['항산 (미구현)','/#sect'],['전투 (미구현)','/#battle']
  ];
  const subtabs=[
    ['빠른 조회',PATHS.quick,'quick'],['자동 탐색',PATHS.auto,'auto'],
    ['수동 제작·정련',PATHS.manual,'manual'],['유일템','/#equip','orange'],
    ['검왕각 수동',PATHS.jianwang,'jianwang'],['검왕각 자동',PATHS.jianwangAuto,'jianwangAuto']
  ];
  const style=document.createElement('style');
  style.textContent=`
  #nangman-direct-header{font-family:system-ui,"Malgun Gothic",sans-serif;position:relative;z-index:500;color:#2c281e;background:#f4eee4;border-bottom:1px solid #d2c2ac}
  #nangman-direct-header a{font:inherit;color:inherit;text-decoration:none}
  #nangman-direct-header .nm-main{min-height:56px;display:flex;align-items:center;gap:18px;padding:7px max(18px,calc((100vw - 1280px)/2));flex-wrap:wrap}
  #nangman-direct-header .nm-logo{font-size:18px;font-weight:650;white-space:nowrap}
  #nangman-direct-header .nm-main-links{display:flex;gap:3px;align-items:center;flex-wrap:wrap}
  #nangman-direct-header .nm-main-links a{padding:8px;font-size:13px;white-space:nowrap}
  #nangman-direct-header .nm-main-links a.active{font-weight:700;border-bottom:2px solid #927a52}
  #nangman-direct-header .nm-sub{display:flex;gap:6px;padding:9px max(18px,calc((100vw - 1280px)/2));overflow:auto;border-top:1px solid #d7c7b750}
  #nangman-direct-header .nm-sub a{padding:7px 11px;border-radius:5px;font-size:12px;white-space:nowrap;border:1px solid #bbaa9366}
  #nangman-direct-header .nm-sub a.active{background:#e7d9c3;border-color:#baa482;font-weight:700}
  #nangman-direct-header .nm-note{margin-left:auto;font-size:11px;color:#756d60}
  @media(max-width:750px){#nangman-direct-header .nm-main{gap:7px;padding:8px 12px}#nangman-direct-header .nm-main-links{overflow-x:auto;flex-wrap:nowrap;max-width:100%}#nangman-direct-header .nm-sub{padding:8px 10px}}
  `;
  document.head.appendChild(style);
  function link(label,url,active=false){const a=document.createElement('a');a.href=url;a.textContent=label;if(active)a.className='active';return a}
  function init(){
    if(document.querySelector('#nangman-direct-header'))return;
    const h=document.createElement('header');h.id='nangman-direct-header';
    const top=document.createElement('div');top.className='nm-main';
    const brand=link('낭만강호','/#wash');brand.className='nm-logo';top.appendChild(brand);
    const menu=document.createElement('nav');menu.className='nm-main-links';
    main.forEach(([name,url])=>menu.appendChild(link(name,url,name==='장비')));top.appendChild(menu);
    const note=document.createElement('span');note.className='nm-note';note.textContent='산부진 APK 장비 엔진';top.appendChild(note);
    const sharedSave=document.createElement('button');
    sharedSave.type='button';sharedSave.textContent='통합 세이브 적용';
    sharedSave.style.cssText='padding:6px 10px;border:1px solid #b5a387;background:#fff9ed;border-radius:5px;font-size:12px;cursor:pointer';
    const saved=sessionStorage.getItem('nangman_shared_save_v1');
    if(saved)sharedSave.onclick=async()=>{
      try{
        if(typeof window.handleSaveFileImport==='function'){
          await window.handleSaveFileImport(new File([saved],'nangman_save.json',{type:'application/json'}));
        }else if(typeof window.loadSaveData==='function'){
          window.loadSaveData(JSON.parse(saved));
        }else{
          throw Error('원본 계산기의 세이브 가져오기 함수가 아직 준비되지 않았습니다. 화면의 원본 가져오기 메뉴를 이용하세요.');
        }
        sharedSave.textContent='세이브 적용 요청 완료';
      }catch(err){sharedSave.textContent='적용 오류 (원본 가져오기 이용)';console.error('공유 세이브',err);}
    };
    else {sharedSave.textContent='원본 가져오기로 세이브 선택';sharedSave.disabled=true}
    top.appendChild(sharedSave);
    const sub=document.createElement('nav');sub.className='nm-sub';
    subtabs.forEach(([name,url,key])=>sub.appendChild(link(name,url,current===key)));
    h.append(top,sub);document.body.prepend(h);
    // The APK's own equipment mode controls use /suanbujin/ paths.
    // Rewrite them to this site's local vendor routes instead of SPA fallbacks.
    for(const a of document.querySelectorAll('a[href]')){
      if(h.contains(a))continue;
      const old=a.getAttribute('href')||'';
      if(old.startsWith('/suanbujin/'))a.setAttribute('href','/vendor'+old);
      if(old.startsWith('../jianwang-')||old.startsWith('../equip-'))continue;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.NangmanEquipmentRoutes=PATHS;
})();