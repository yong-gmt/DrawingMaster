const {chromium}=require('./_pw');
const APP=require('./harness').APP;
// Nothing the program invents may appear from an import alone: no re-drawn
// dimensions, no re-drawn markers. Import shows the file; STYLIZE changes it.
(async()=>{
  const b=await chromium.launch();
  for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
    await p.goto('file://'+APP); await p.waitForTimeout(900);
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(500);
    await p.click('#btnImport');
    await p.setInputFiles('#fileInput', require('./harness').fixture(dxf));
    await p.waitForTimeout(1900);
    const count=()=>p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      /* A TAG is not a redraw: a marker tags the file's own strokes so it knows
         which ones are its to take over later. Count only strokes WE created. */
      let ours=0, oursText=0;
      (P.objects||[]).forEach(o=>{
        (o.prims.polys||[]).forEach(q=>{ if(q._dimPart||q._src==='BALLOON'||q._ansi) ours++; });
        (o.prims.texts||[]).forEach(t=>{ if(t._dimPart||t._src==='BALLOON') oursText++; });
      });
      return {dims:(P.dxf.dims||[]).length,
              dimsWaiting:(P.dxf.dims||[]).filter(m=>m.pending).length,
              secs:(P.dxf.secs||[]).length,
              secsWaiting:(P.dxf.secs||[]).filter(s=>s.pending).length,
              strokesWeDrew:ours, textsWeDrew:oursText};
    });
    const imported=await count();
    await p.click('#btnStylize'); await p.waitForTimeout(1000);
    const styled=await count();
    console.log(dxf);
    console.log('  after import  : models', imported.dims, '(waiting '+imported.dimsWaiting+')',
                '· markers', imported.secs, '(waiting '+imported.secsWaiting+')',
                '| strokes WE drew:', imported.strokesWeDrew,
                '| texts WE drew:', imported.textsWeDrew);
    console.log('  after STYLIZE : still waiting', styled.dimsWaiting+styled.secsWaiting,
                '| strokes WE drew:', styled.strokesWeDrew);
    console.log('  errors:', errs.length, errs.slice(0,2));
    await p.context().close();
  }
  await b.close();
})();
