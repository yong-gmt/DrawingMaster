const {chromium}=require('./_pw');
const path=require('path');
// Clicking a dimension must still select ONLY that dimension - annotation follows
// geometry, not the other way round - otherwise nothing could be edited on its own.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(800);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  const at=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.ok&&x.dir);
    const g=h.dimGeomOf(m), seg=g.segs.find(s=>!s.hidden&&s.a);
    const grips=h.dimModelGrips(P);
    let q=[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];
    for(let f=0.05;f<=0.95;f+=0.05){ const t=[seg.a[0]+(seg.b[0]-seg.a[0])*f, seg.a[1]+(seg.b[1]-seg.a[1])*f];
      if(grips.every(gr=>Math.hypot(gr.at[0]-t[0],gr.at[1]-t[1])>2.5)){ q=t; break; } }
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(q[0],q[1]);
    window.__dim=m.id;
    return {x:rc.left+A.x, y:rc.top+A.y};
  });
  await p.mouse.move(at.x,at.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const sel=[...h.selIds];
    const mine=(P.objects||[]).filter(o=>h.selIds.has(o.id) && o._dim===window.__dim).length;
    return {selected:sel.length, ofThisDimension:mine};
  });
  console.log('clicking a dimension selects:', r.selected, 'objects, of which',
              r.ofThisDimension, 'belong to that dimension');
  console.log('  only its own parts:', r.selected===r.ofThisDimension);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
