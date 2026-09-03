const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// The user's real situation: they worked in the build I sent LAST time, then I
// sent a rolled-back one. The saved project is written by one build and opened by
// the other, in the same browser.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  const open=async(f)=>{ await p.goto('file://'+require('./harness').fixture(f)); await p.waitForTimeout(1000); };

  console.log('1. work in the build sent last time');
  await open('DrawingMaster_59_experimental.html');
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  let sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  await p.evaluate(()=>window.__hook().persist&&window.__hook().persist());
  await p.waitForTimeout(500);

  console.log('2. now open the rolled-back build in the same browser');
  await open(require('./harness').APP);
  fs.writeFileSync('cross_dash.png', await p.screenshot());
  const card=await p.$('text=Project 1');
  console.log('   project card on the dashboard:', !!card);
  if(card){ await card.click(); await p.waitForTimeout(1500);
    const sh2=await p.$('text=Sheet 01'); if(sh2&&await sh2.isVisible()) await sh2.click();
    await p.waitForTimeout(900); }
  const r=await p.evaluate(()=>{
    const h=window.__hook&&window.__hook();
    if(!h||!h.store) return {noStore:true};
    const P=h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
    const cv=document.querySelector('canvas'); let ink=0;
    if(cv){ const c=cv.getContext('2d'); const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
    return {page:P&&P.name, objects:P&&(P.objects||[]).length,
            dims:P&&P.dxf&&(P.dxf.dims||[]).length, inkOnCanvas:ink};
  });
  console.log('   after reopening:', JSON.stringify(r));
  fs.writeFileSync('cross_sheet.png', await p.screenshot());
  console.log('   javascript errors:', errs.length);
  errs.slice(0,5).forEach(e=>console.log('     '+e));
  await b.close();
})();
