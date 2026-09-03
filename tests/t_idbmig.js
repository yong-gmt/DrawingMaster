const {chromium}=require('./_pw');
const path=require('path');
// Somebody with projects already saved the old way must not lose them, and the
// old 5 MB copy must be released so the old limit stops being the limit.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  // fill the OLD store using the previous build
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  for(let i=0;i<3;i++){
    const back=await p.$('#btnBack'); if(back && await back.isVisible()){ await back.click(); await p.waitForTimeout(300); }
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(450);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(280);
    await p.click('#btnImport'); await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
    await p.waitForTimeout(1400);
  }
  const before=await p.evaluate(()=>({localStorageBytes:(localStorage['drawingmaster.projects.v1']||'').length}));
  console.log('saved the old way:', JSON.stringify(before));

  // now open the new build in the same browser
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(1600);
  const after=await p.evaluate(async()=>{
    const h=window.__hook(); const rows=await h.idbAll();
    return {movedAcross:rows?rows.length:0,
            localStorageBytes:(localStorage['drawingmaster.projects.v1']||'').length,
            usingIDB:h.usingIDB()};
  });
  console.log('after opening the new build:', JSON.stringify(after));
  const card=await p.$('text=Project 1');
  if(card){ await card.click(); await p.waitForTimeout(1500);
    const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
    await p.waitForTimeout(900);
    console.log('an old project still opens:', await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      return JSON.stringify({objects:(P.objects||[]).length, dims:(P.dxf.dims||[]).length});
    }));
  }
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
