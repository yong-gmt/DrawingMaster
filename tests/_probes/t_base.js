const _p=require('path');
const {open,loadDxf}=require('./harness');
(async()=>{
  const file=process.argv[2]||_p.join(require('./harness').ROOT,'src','base.html');
  for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const {b,pg}=await open(file);
    await loadDxf(pg,dxf);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const d=P.dxf;
      const dims={}; (d.polys||[]).forEach(p=>{ if(p._dim) (dims[p._dim]=dims[p._dim]||[]).push(p); });
      return {polys:d.polys.length, texts:d.texts.length, solids:d.solids.length,
              hatches:d.hatches.length, dimGroups:Object.keys(dims).length,
              models:(d.dims||[]).length, ok:(d.dims||[]).filter(m=>m.ok).length,
              objs:(P.objects||[]).length};
    });
    console.log(dxf, JSON.stringify(r));
    await b.close();
  }
})();
