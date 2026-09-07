/* After STYLIZE, is the file's original angular geometry still on the page
   alongside the restyled version? A stroke the model drew carries a _role; one
   the file drew does not. */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const DXF=process.argv[2]||'ang_mirror.dxf';
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2200);
  const look=()=>p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ids=new Set((h.dimModels(pg)||[]).filter(m=>m.kind==='angular').map(m=>m.id));
    let model=0, file=0, filePts=[];
    (pg.dxf.polys||[]).forEach(q=>{ if(!ids.has(q._dim)) return;
      if(!q.pts||!q.pts.length) return;
      if(q._role) model++; else { file++; filePts.push(q.pts.length); } });
    return {model, file, filePts:filePts.slice(0,6)};
  });
  console.log(DXF);
  console.log('  after import : '+JSON.stringify(await look()));
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  console.log('  after stylize: '+JSON.stringify(await look()));
  fs.writeFileSync(path.join(OUT,'ui_angleft.png'), await p.locator('#stage').screenshot());
  await b.close();
})();
