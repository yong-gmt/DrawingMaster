const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(process.argv[2]||'angles.dxf'));
  await p.waitForTimeout(2200);
  console.log(JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    return (h.dimModels(pg)||[]).filter(m=>m.kind==='angular').map(m=>({
      deg:+(Math.abs(m.sweep)*180/Math.PI).toFixed(2), a0:+(m.a0*180/Math.PI).toFixed(1), sweep:+(m.sweep*180/Math.PI).toFixed(1),
      value:m.text.value, num:m.text.num===undefined?'(unset)':m.text.num, ok:m.ok, authored:!!m.authored, dev:+(m.dev||0).toFixed(3) }));
  }),null,0));
  // and every text the file itself carries
  console.log('texts in the file: '+JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    return (pg.dxf.texts||[]).map(t=>String(t.text)); })));
  await b.close();
})();
