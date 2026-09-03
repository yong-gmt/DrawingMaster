const {chromium}=require('./_pw');
const APP=require('./harness').APP;
const path=require('path');
// STYLIZE, leave the project, come back. Everything the drawing looked like must
// still be there - the strokes AND the flags that say how to draw them.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  const look=async(tag)=>{
    const r=await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      let secArrows=0, secDash=0, secHidden=0, secPolys=0, dimArrows=0, ansiFlags=0;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{
        if(q._sec){ secPolys++; if(q._arrow) secArrows++; if(q.dash&&q.dash.length>=6) secDash++; }
        if(q._secUnder) secHidden++;
        if(q._dim && q._arrow) dimArrows++;
        if(q._ansi) ansiFlags++;
      }));
      let looseSolids=0;
      (P.objects||[]).forEach(o=>(o.prims.solids||[]).forEach(s=>{ if(s._sec) looseSolids++; }));
      return {secPolys, secArrowCaps:secArrows, secPhantomLines:secDash,
              centreLinesCovered:secHidden, dimArrowCaps:dimArrows,
              restyledFlags:ansiFlags, sectionSolidsStillLoose:looseSolids};
    });
    console.log('  '+tag, JSON.stringify(r)); return r;
  };
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Body_Demo_Drawing_Sheet3.dxf'));
  await p.waitForTimeout(1900);
  await p.click('#btnStylize'); await p.waitForTimeout(1000);
  const before=await look('right after STYLIZE :');

  // leave the project and come back, the way a person does
  const back=await p.$('#btnBack'); if(back && await back.isVisible()) await back.click();
  await p.waitForTimeout(900);
  const card=await p.$('text=Project 1');
  if(card){ await card.click(); await p.waitForTimeout(1600);
    const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
    await p.waitForTimeout(900); }
  const after=await look('after coming back   :');

  const keys=Object.keys(before);
  const lost=keys.filter(k=>before[k]!==after[k]);
  console.log('  what did not survive:', lost.length? lost.map(k=>k+' '+before[k]+' -> '+after[k]) : 'nothing');

  // and pressing STYLIZE again should have nothing left to do
  await p.click('#btnStylize'); await p.waitForTimeout(1000);
  const again=await look('after pressing again:');
  console.log('  pressing again changed things:',
              keys.some(k=>again[k]!==after[k]));
  console.log('  errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
