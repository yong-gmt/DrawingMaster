const {open,loadDxf}=require('./harness');
// The same drawings with their DIMENSION entities exploded into loose lines - the
// shape a great many CAD exports arrive in. If STYLIZE only works when the file
// labels its own dimensions, this is where it stops working.
(async()=>{
 for(const dxf of ['exploded_Head-back.dxf','exploded_Body_Demo_Drawing_Sheet1.dxf',
                   'exploded_Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let modelPolys=0, fallbackPolys=0, untouchedPolys=0, modelTexts=0, fallbackTexts=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>{ if(p._dimPart||p._sec) modelPolys++;
        else if(p._ansi) fallbackPolys++; else untouchedPolys++; });
      (o.prims.texts||[]).forEach(t=>{ if(t._dimPart||t._sec) modelTexts++;
        else if(t._ansiDone) fallbackTexts++; });
    });
    return {dimensionModels:(P.dxf.dims||[]).length,
            sectionMarkers:(P.dxf.secs||[]).length,
            modelPolys, fallbackPolys, untouchedPolys, modelTexts, fallbackTexts};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
