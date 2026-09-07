const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('Body_Demo_Drawing_Sheet3.dxf'));
  await p.waitForTimeout(2400);
  await p.click('#btnStylize'); await p.waitForTimeout(2600);
  // zoom to the first angular dimension
  await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(h.dimModels(pg)||[]).filter(x=>x.kind==='angular')[0];
    const C=m.centre, r=m.radius*1.5;
    h.zoomRect(C[0]-r, C[1]-r, C[0]+r, C[1]+r); });
  await p.waitForTimeout(600);
  fs.writeFileSync(path.join(OUT,'ui_angpic.png'), await p.locator('#stage').screenshot());
  console.log('shot');
  await b.close();
})();
