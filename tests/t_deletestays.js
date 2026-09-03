const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE='/tmp/dm-delete';
// Deleted has to mean gone. The object list is rebuilt from the drawing every time
// anything is added or the program is reopened, so a piece that is only removed
// from the object list comes back.
(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  const count=(p)=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {objects:(P.objects||[]).length,
            strokesInTheDrawing:(P.dxf.polys||[]).length,
            textsInTheDrawing:(P.dxf.texts||[]).length};
  });
  let c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  let p=c.pages()[0]||await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  let sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);
  await p.click('#btnStylize'); await p.waitForTimeout(1300);
  const start=await count(p);
  console.log('after STYLIZE          :', JSON.stringify(start));

  // delete 30 plain strokes, the way a person does
  const removed=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const pick=(P.objects||[]).filter(o=>!o._dim&&!o._sec&&!o._bal).slice(0,30);
    h.setSelection(pick.map(o=>o.id));
    return pick.length;
  });
  await p.keyboard.press('Delete'); await p.waitForTimeout(600);
  const afterDel=await count(p);
  console.log('after deleting '+removed+'      :', JSON.stringify(afterDel));

  // adding something rebuilds the object list - the deleted pieces must not return
  await p.click('#btnBalloon'); await p.waitForTimeout(800);
  const afterAdd=await count(p);
  console.log('after adding a balloon :', JSON.stringify(afterAdd));
  await c.close();

  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0]||await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1'); if(card) await card.click();
  await p.waitForTimeout(1600);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(900);
  const back=await count(p);
  console.log('after reopening        :', JSON.stringify(back));
  /* Two things must BOTH hold: what was deleted is gone, and nothing else went
     with it. A filter that keeps only what the object list still references
     satisfies the first and wipes the drawing - so count both sides. */
  console.log('  deleted pieces stayed deleted:',
    back.strokesInTheDrawing===afterAdd.strokesInTheDrawing);
  console.log('  nothing else disappeared     :',
    afterDel.strokesInTheDrawing===start.strokesInTheDrawing-removed &&
    afterDel.textsInTheDrawing===start.textsInTheDrawing);
  console.log('errors:', errs.length, errs.slice(0,2));
  await c.close();
})();
