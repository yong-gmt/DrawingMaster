const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('ang_mirror.dxf'));
  await p.waitForTimeout(2200);
  console.log('agreeing candidates [s0,sweep,sup]: '+JSON.stringify(await p.evaluate(()=>window.__angLog||null)));
  console.log('chosen: '+JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    return (h.dimModels(pg)||[]).filter(m=>m.kind==='angular')
      .map(m=>({a0:Math.round(m.a0*180/Math.PI), sweep:Math.round(m.sweep*180/Math.PI)})); })));
  await b.close();
})();
