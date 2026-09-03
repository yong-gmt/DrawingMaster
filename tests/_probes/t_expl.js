const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'exploded.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    return {polys:d.polys.length, texts:d.texts.length, solids:d.solids.length,
            dimensionModels:(d.dims||[]).length, sections:(d.secs||[]).length,
            sampleText:(d.texts||[]).slice(0,6).map(t=>String(t.text))};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
