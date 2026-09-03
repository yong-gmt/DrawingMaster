const _p=require('path');
const {open,loadDxf}=require('./harness');
(async()=>{
 for(const f of [_p.join(require('./harness').ROOT,'src','base.html'),require('./harness').APP]){
  const {b,pg}=await open(f);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const g=(t)=>t;
  const h0=await pg.evaluate(()=>{const h=window.__hook(),P=h.store.pages.find(x=>x.id===h.store.activeId);
    const hs=[];(P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{if(t._dim)hs.push(+t.h.toFixed(2));}));
    return {n:hs.length, min:Math.min(...hs), max:Math.max(...hs)};});
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const h1=await pg.evaluate(()=>{const h=window.__hook(),P=h.store.pages.find(x=>x.id===h.store.activeId);
    const hs=[];(P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{if(t._dim)hs.push(+t.h.toFixed(2));}));
    return {n:hs.length, min:Math.min(...hs), max:Math.max(...hs)};});
  console.log(f,'before',JSON.stringify(h0),'after',JSON.stringify(h1));
  await b.close();
 }
})();
