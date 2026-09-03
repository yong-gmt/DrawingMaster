const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// Nothing the program invents may appear on the page from an import alone:
// no zig-zag foreshortening, no centre crosses, no re-drawn leaders.
(async()=>{
  const b=await chromium.launch();
  for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
    await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(800);
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(500);
    await p.click('#btnImport');
    await p.setInputFiles('#fileInput', require('./harness').fixture(dxf));
    await p.waitForTimeout(1800);
    const after=await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      let ourStrokes=0, ourTexts=0;
      (P.objects||[]).forEach(o=>{
        (o.prims.polys||[]).forEach(q=>{ if(q._dimPart||q._src==='BALLOON') ourStrokes++; });
        (o.prims.texts||[]).forEach(t=>{ if(t._dimPart) ourTexts++; });
      });
      return {models:(P.dxf.dims||[]).length,
              waitingForStylize:(P.dxf.dims||[]).filter(m=>m.pending).length,
              strokesWeDrew:ourStrokes, textsWeDrew:ourTexts};
    });
    await p.click('#btnStylize'); await p.waitForTimeout(900);
    const styled=await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      let ourStrokes=0;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{ if(q._dimPart) ourStrokes++; }));
      return {stillWaiting:(P.dxf.dims||[]).filter(m=>m.pending).length, strokesWeDrew:ourStrokes};
    });
    console.log(dxf);
    console.log('  after import  : models', after.models,
                '| waiting for STYLIZE', after.waitingForStylize,
                '| strokes WE drew', after.strokesWeDrew, '| texts WE drew', after.textsWeDrew);
    console.log('  after STYLIZE : still waiting', styled.stillWaiting,
                '| strokes WE drew', styled.strokesWeDrew);
    console.log('  errors:', errs.length, errs.slice(0,2));
    await p.context().close();
  }
  await b.close();
})();
