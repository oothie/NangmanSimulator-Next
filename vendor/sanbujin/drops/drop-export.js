/* CSV export of computed field/dungeon forecasts, without claiming final refinement.
 * Pure formatter supports source values and spreadsheet injection protection. */
(function(root){
'use strict';
const sanitize=value=>{
 let cell=String(value??'');
 if(/^[\s\u0000-\u001f]*[=+@-]/.test(cell))cell="'"+cell;
 return '"'+cell.replace(/"/g,'""')+'"';
};
function csv(columns,rows){
 if(!Array.isArray(columns)||!columns.length||!Array.isArray(rows)||rows.length>10000)
  throw Error('드랍 결과 CSV 형식을 확인할 수 없습니다.');
 return '\uFEFF'+[columns.map(x=>sanitize(x.title)).join(','),
  ...rows.map(row=>columns.map(column=>sanitize(
   typeof column.value==='function'?column.value(row):row[column.key]
  )).join(','))].join('\r\n')+'\r\n';
}
function save(name,columns,rows){
 if(!rows?.length)throw Error('먼저 드랍 계산을 실행하세요.');
 const nameSafe=String(name).replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,80);
 const contents=csv(columns,rows);
 const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
 try{
  const el=document.createElement('a');
  el.href=url;el.download=nameSafe+'.csv';
  document.body.append(el);el.click();el.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
root.SBJDropExport={csv,save};
})(window);
