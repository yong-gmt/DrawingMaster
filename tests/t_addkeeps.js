const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// Adding a label, a balloon or a BOM must not disturb what is already on the page:
// nothing springs back to where it was imported, and the section markers keep the
// strokes they took over. And a balloon must be its own thing - movable, and
// deletable without taking another with it.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);
  await p.click('#btnStylize'); await p.waitForTimeout(1200);

  // move everything, so there is something to lose
  await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.setSelection((P.objects||[]).map(o=>o.id));
    (P.objects||[]).forEach(o=>{ o.dx=-22; o.dy=18; });
    h.setSelection([]); h.render();
  });
  await p.waitForTimeout(300);
  const state=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let mark=null, secStrokes=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.texts||[]).forEach(t=>{
        if(String(t.text).trim()==='FRONT VIEW') mark=[+(t.x+(o.dx||0)).toFixed(2), +(t.y+(o.dy||0)).toFixed(2)]; });
      (o.prims.polys||[]).forEach(q=>{ if(q._sec && (q.pts||[]).length>=4) secStrokes++; }); });
    return {frontView:mark, sectionLines:secStrokes,
            balloons:(P.dxf.balloons||[]).length};
  });
  const before=await state();
  console.log('after moving the page     :', JSON.stringify(before));

  await H.addBalloon(p); await p.waitForTimeout(700);
  const afterBal=await state();
  console.log('after adding a balloon    :', JSON.stringify(afterBal));
  await p.click('#btnText'); await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const afterTxt=await state();
  console.log('after adding a label      :', JSON.stringify(afterTxt));

  console.log('the page stayed put       :',
    JSON.stringify(afterTxt.frontView)===JSON.stringify(before.frontView));
  console.log('the section line survived :',
    afterTxt.sectionLines===before.sectionLines && before.sectionLines>0);

  // two balloons, then delete the first: the second must be untouched
  await H.addBalloon(p); await p.waitForTimeout(700);
  const ids=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.balloons||[]).map(m=>m.id);
  });
  console.log('balloon ids               :', JSON.stringify(ids),
              '| all different:', new Set(ids).size===ids.length);
  const del=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const first=(P.dxf.balloons||[])[0].id;
    h.setSelection((P.objects||[]).filter(o=>o._bal===first).map(o=>o.id));
    return [...h.selIds].length;
  });
  await p.evaluate(()=>window.__hook().deleteSelection && window.__hook().deleteSelection());
  await p.waitForTimeout(400);
  // adding another must not bring the deleted one back
  await H.addBalloon(p); await p.waitForTimeout(700);
  const end=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {balloons:(P.dxf.balloons||[]).length,
            ids:(P.dxf.balloons||[]).map(m=>m.id),
            circles:(P.dxf.polys||[]).filter(q=>q._role==='ring').length};
  });
  console.log('deleted 1 of 2, added 1   :', JSON.stringify(end),
              '| the deleted one stayed gone:', end.balloons===2 && end.circles===2);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
