const {open,loadDxf}=require('./harness');
// Every piece of annotation text must end up at the size Format Config asks for.
// Anything left at another size is either sheet furniture (correct) or a miss.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf','exploded.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=14; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1000);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+(14*25.4/72).toFixed(3);
    const groups={};
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      const kind = t._dim? 'dimension value'
                 : t._sec? 'section letter'
                 : t._user? 'label the user added'
                 : 'other text';
      const k=kind+' @'+(+t.h).toFixed(2);
      (groups[k]||(groups[k]=[])).push(String(t.text).slice(0,14));
    }));
    /* Sheet furniture is meant to keep its own size, so counting it as "not
       resized" made a correct result look like 40 misses. Ask the app which text
       it treated as furniture and judge only the rest. */
    const report=h.textReport();
    const missed=report.filter(r=>!r.atWantedSize &&
      r.treatedAs!=='sheet furniture - left alone' && r.treatedAs!=='label you added');
    return {wantMM:want, groups:Object.fromEntries(
      Object.entries(groups).map(([k,v])=>[k, v.length])),
      furnitureLeftAlone:report.filter(r=>r.treatedAs==='sheet furniture - left alone').length,
      annotationMissed:missed.length, examples:missed.slice(0,4)};
  });
  console.log(dxf, '| wanted', r.wantMM, 'mm | furniture left alone:',
              r.furnitureLeftAlone, '| ANNOTATION MISSED:', r.annotationMissed);
  if(r.annotationMissed) console.log('    ', JSON.stringify(r.examples));
  await b.close();
 }
})();
