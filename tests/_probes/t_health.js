const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// Is the build actually alive? Import, look for the sheet frame, then reload the
// page in the same browser and see whether the project is still there.
(async()=>{
  const file=process.argv[2];
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto('file://'+require('./harness').fixture(file)); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  const state=await p.evaluate(()=>{
    const h=window.__hook&&window.__hook();
    const P=h&&h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
    const cv=document.querySelector('canvas');
    let ink=0;
    try{ const c=cv.getContext('2d');
      const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }catch(e){}
    return { objects:P?(P.objects||[]).length:-1, ink,
             saved:(localStorage['drawingmaster.projects.v1']||'').length };
  });
  fs.writeFileSync('health_'+path.basename(file)+'.png', await p.locator('canvas').first().screenshot());
  // now reload in the SAME browser - the project must still be listed
  await p.goto('file://'+require('./harness').fixture(file)); await p.waitForTimeout(1200);
  const back=await p.evaluate(()=>{
    const cards=document.querySelectorAll('#dashboard .card, #dashboard [data-proj], #dashboard *');
    const txt=document.body.innerText||'';
    return { savedBytes:(localStorage['drawingmaster.projects.v1']||'').length,
             showsAProject:/Project\s*1/.test(txt) };
  });
  console.log(file);
  console.log('  after import : objects', state.objects, '| ink on canvas', state.ink,
              '| saved bytes', state.saved);
  console.log('  after reload : saved bytes', back.savedBytes,
              '| the project is listed:', back.showsAProject);
  console.log('  javascript errors:', errs.length, errs.slice(0,3));
  await b.close();
})();
