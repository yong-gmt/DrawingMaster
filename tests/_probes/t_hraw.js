const {open,loadDxf}=require('./harness');
(async()=>{
  for(const f of ['hatch_test.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,f);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      return (P.dxf.hatches||[]).map(ht=>({p:ht.pattern, lines:ht.lines}));
    });
    console.log(f, JSON.stringify(r));
    await b.close();
  }
})();
