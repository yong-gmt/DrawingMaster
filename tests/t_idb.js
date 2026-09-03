const {chromium}=require('./_pw');
const path=require('path');
// The store that broke on this machine: a dozen imported drawings in one browser.
// It has to hold them now, and hold them across a reload.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  const warn=[]; p.on('console',m=>{ if(/full|quota|could not save/i.test(m.text())) warn.push(m.text().slice(0,110)); });
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(1200);
  console.log('IndexedDB in use:', await p.evaluate(()=>window.__hook().usingIDB()));
  const files=['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf'];
  for(let i=0;i<20;i++){
    const back=await p.$('#btnBack'); if(back && await back.isVisible()){ await back.click(); await p.waitForTimeout(300); }
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(420);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(260);
    await p.click('#btnImport'); await p.setInputFiles('#fileInput', require('./harness').fixture(files[i%3]));
    await p.waitForTimeout(1300);
  }
  const mid=await p.evaluate(async()=>{
    const h=window.__hook();
    const rows=await h.idbAll();
    const est=await h.storageReport();
    let ls=0; try{ ls=(localStorage['drawingmaster.projects.v1']||'').length; }catch(e){}
    return {projectsStored:rows?rows.length:'(none)',
            usedMB:+(est.used/1048576).toFixed(1), quotaMB:Math.round(est.quota/1048576),
            leftInLocalStorage:ls};
  });
  console.log('after 20 imports:', JSON.stringify(mid));
  await p.reload(); await p.waitForTimeout(1600);
  const after=await p.evaluate(async()=>{
    const rows=await window.__hook().idbAll();
    return {onDashboard:document.querySelectorAll('#dashboard .card, #dashboard [data-proj]').length,
            inStore:rows?rows.length:0};
  });
  console.log('after a reload:', JSON.stringify(after));
  const card=await p.$('text=Project 1');
  if(card){ await card.click(); await p.waitForTimeout(1600);
    const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
    await p.waitForTimeout(900);
    const r=await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const cv=document.querySelector('canvas'); let ink=0;
      const c=cv.getContext('2d'); const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++;
      return {objects:(P.objects||[]).length, dims:(P.dxf.dims||[]).length, ink};
    });
    console.log('opening the first one:', JSON.stringify(r));
  }
  console.log('"storage full" warnings:', warn.length, warn.slice(0,2));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
