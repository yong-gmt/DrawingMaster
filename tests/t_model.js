const {open,loadDxf}=require('./harness');
(async()=>{
  const file=process.argv[2]||require('./harness').APP;
  for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const {b,pg}=await open(file);
    await loadDxf(pg,dxf);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const d=P.dxf, ms=d.dims||[];
      return {polys:d.polys.length, solids:d.solids.length, models:ms.length,
        ok:ms.filter(m=>m.ok).length,
        bad:ms.filter(m=>!m.ok).map(m=>({id:m.id,dev:+(m.dev||0).toFixed(2),odd:m.odd})),
        maxdev:+Math.max(0,...ms.filter(m=>m.ok).map(m=>m.dev)).toFixed(3)};
    });
    console.log(dxf, JSON.stringify(r));
    await b.close();
  }
})();
