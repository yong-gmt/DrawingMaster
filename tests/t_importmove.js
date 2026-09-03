const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// Import a drawing, move it somewhere, then import another. The first must stay
// exactly where it was put, and the new one must land clear of it.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  const imp=async(f)=>{ await p.click('#btnImport');
    await p.setInputFiles('#fileInput', H.fixture(f)); await p.waitForTimeout(2000); };
  const box=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.entitiesBBox(P);
    return [+bb.minx.toFixed(2),+bb.miny.toFixed(2),+bb.maxx.toFixed(2),+bb.maxy.toFixed(2)];
  });

  await imp('Head-back.dxf');
  const first=await box();
  console.log('first drawing lands at      :', JSON.stringify(first));

  // move it: select everything and shift it by a known amount
  await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.setSelection((P.objects||[]).map(o=>o.id));
    (P.objects||[]).forEach(o=>{ o.dx=-30; o.dy=25; });
    h.setSelection([]); h.render();
  });
  await p.waitForTimeout(300);
  const moved=await box();
  console.log('after moving it by -30, +25  :', JSON.stringify(moved));

  const landmark=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let t=null;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{
      if(String(x.text).trim()==='FRONT VIEW') t=[x.x+(o.dx||0), x.y+(o.dy||0)]; }));
    return t? t.map(v=>+v.toFixed(2)) : null;
  });
  const firstBefore=await landmark();
  await imp('Body_Demo_Drawing_Sheet1.dxf');
  const after=await box();
  const firstStill=await p.evaluate((moved)=>{
    // is the first drawing still where it was put? look for its own view label
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let t=null;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{
      if(String(x.text).trim()==='FRONT VIEW') t=[x.x+(o.dx||0), x.y+(o.dy||0)]; }));
    return t? t.map(v=>+v.toFixed(2)) : null;
  }, moved);
  console.log('after importing a second file:', JSON.stringify(after));
  console.log('"FRONT VIEW" of the first is now at:', JSON.stringify(firstStill));
  /* The sheet's overall box grows because the new drawing joins it, so compare
     the FIRST drawing's own landmark instead: its "FRONT VIEW" label. */
  console.log('the first drawing stayed put :',
    Math.abs(firstStill[0]-firstBefore[0])<0.01 && Math.abs(firstStill[1]-firstBefore[1])<0.01,
    ' (was', JSON.stringify(firstBefore)+')');
  console.log('the new one landed to the right of it:', after[2]>moved[2]+5);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
