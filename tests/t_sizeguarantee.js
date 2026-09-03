const {open,loadDxf}=require('./harness');
// Whatever the drawing does, every piece of annotation must come out at the size
// Format Config asks for. This breaks the chain deliberately - it takes a model
// that has already been applied and puts the file's own text height back - so the
// guarantee is tested rather than the happy path.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf','exploded.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(900);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // sabotage: shrink the value of every circle dimension, and its model with it
    let spoiled=0;
    (P.dxf.dims||[]).forEach(m=>{
      if(m.kind!=='radial' && m.kind!=='diameter') return;
      m.text.h=1.2; spoiled++; });
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!t._dim) return;
      const m=(P.dxf.dims||[]).find(x=>x.id===t._dim);
      if(m && (m.kind==='radial'||m.kind==='diameter')) t.h=1.2; }));
    h.store.format.fontSize=12;
    document.querySelector('#btnStylize').click();
    return spoiled;
  });
  await pg.waitForTimeout(1000);
  const out=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+(12*25.4/72).toFixed(3);
    const rows=h.textReport();
    const bad=rows.filter(x=>x.treatedAs!=='sheet furniture - left alone'
                          && x.treatedAs!=='label you added' && !x.atWantedSize);
    let circleValues=0, circleWrong=0;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!t._dim) return;
      const m=(P.dxf.dims||[]).find(x=>x.id===t._dim);
      if(!m || (m.kind!=='radial'&&m.kind!=='diameter')) return;
      circleValues++; if(Math.abs(t.h-want)>0.01) circleWrong++; }));
    return {want, circleValues, circleValuesAtWrongSize:circleWrong,
            anyAnnotationAtWrongSize:bad.length};
  });
  console.log(dxf, '| circle dimension values:', out.circleValues,
              '| at the wrong size:', out.circleValuesAtWrongSize,
              '| any annotation at the wrong size:', out.anyAnnotationAtWrongSize);
  await b.close();
 }
})();
