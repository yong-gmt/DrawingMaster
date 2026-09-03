const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.solids||[]).map(sd=>sd.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]));
  });
  r.forEach((s,i)=>console.log(i, JSON.stringify(s)));
  await b.close();
})();
