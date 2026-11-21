/* v0.8.0: parent theme -> all Sanbujin feature iframes. */
(function(){
  'use strict';
  function normalize(value){return value==='dark'||value==='ink'?'dark':'light';}
  function apply(value){
    const theme=normalize(value),doc=document.documentElement;
    doc.dataset.sbjTheme=theme;
    doc.dataset.nangmanTheme=theme;
    doc.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#15181f':'#f3eee3');
  }
  function parentTheme(){
    try{
      if(window.parent!==window&&window.parent.location.origin===window.location.origin){
        return window.parent.document.documentElement.dataset.theme==='ink'?'dark':'light';
      }
    }catch(e){}
    return document.documentElement.dataset.sbjTheme||'light';
  }
  apply(parentTheme());
  window.addEventListener('message',function(event){
    if(event.origin!==location.origin||event.source!==parent)return;
    if(event.data?.kind==='nangman-equipment-theme'||event.data?.kind==='nangman-theme'){
      apply(event.data.theme);
    }
  });
  window.addEventListener('pageshow',function(){apply(parentTheme())});
})();
