const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE='/tmp/dm-secreopen';
// A marker whose cut runs along the part's own centre line has no stroke of its
// own - STYLIZE makes one. That stroke has to be part of the drawing, or it is
// gone when the program is reopened and the marker comes back as two letters with
// nothing between them.
(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  const look=(p)=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let drawn=0, letters=0, inDrawing=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>{ if(q._sec && (q.pts||[]).length>=4) drawn++; });
      (o.prims.texts||[]).forEach(t=>{ if(t._sec) letters++; }); });
    (P.dxf.polys||[]).forEach(q=>{ if(q._sec && (q.pts||[]).length>=4) inDrawing++; });
    return {cutLinesDrawn:drawn, cutLinesInTheDrawing:inDrawing, letters};
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
  // take away the strokes the marker would otherwise reuse, so it has to make one
  const stripped=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let n=0;
    (P.dxf.polys||[]).forEach(q=>{ if(q._section && (q.pts||[]).length===2){ q._section=false; n++; } });
    h.buildObjects(P); h.render(); return n;
  });
  console.log('section-layer strokes hidden from the marker:', stripped);
  await p.click('#btnStylize'); await p.waitForTimeout(1300);
  const a=await look(p);
  console.log('after STYLIZE :', JSON.stringify(a));
  await c.close();

  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0]||await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1'); if(card) await card.click();
  await p.waitForTimeout(1600);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(900);
  const b=await look(p);
  console.log('after reopening:', JSON.stringify(b));
  console.log('  the cut line survived:', b.cutLinesDrawn===a.cutLinesDrawn && a.cutLinesDrawn>0);
  console.log('  letters survived     :', b.letters===a.letters);
  console.log('errors:', errs.length, errs.slice(0,2));
  await c.close();
})();
