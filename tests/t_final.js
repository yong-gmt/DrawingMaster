const {open,loadDxf}=require('./harness');
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await loadDxf(pg,dxf);
  const a=await pg.evaluate(()=>{const h=window.__hook(),P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {polys:P.dxf.polys.length, models:(P.dxf.dims||[]).length, ok:(P.dxf.dims||[]).filter(m=>m.ok).length,
            objs:P.objects.length, report:P.dxf.polys.filter(p=>p._dim).length};});
  // export paths must survive the new prim shape
  const exp=await pg.evaluate(()=>{ const h=window.__hook(); const out={};
    try{ h.exportDXF(); out.dxf='ok'; }catch(e){ out.dxf=String(e).slice(0,80); }
    try{ const P=h.store.pages.find(x=>x.id===h.store.activeId); h.captureSheet(P); out.pdf='ok'; }catch(e){ out.pdf=String(e).slice(0,80); }
    return out; });
  // persistence round trip
  const persisted=await pg.evaluate(async()=>{
    const h=window.__hook(); localStorage.setItem('__t', JSON.stringify(h.store));
    const back=JSON.parse(localStorage.getItem('__t'));
    const P=back.pages.find(x=>x.id===back.activeId);
    return {dims:(P.dxf.dims||[]).length, hasDir:!!(P.dxf.dims||[])[0]?.dir};});
  console.log(dxf, JSON.stringify({...a, exp, persisted, errs:errs.slice(0,2)}));
  await b.close();
 }
})();
