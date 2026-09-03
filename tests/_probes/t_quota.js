const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// HYPOTHESIS: after hours of importing across many builds, the browser's storage
// is full. Saving then throws, and if the throw happens part-way through the
// "changed something" step, the redraw never runs - a blank page.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  // fill the storage up to just under the limit
  const filled=await p.evaluate(()=>{
    let mb=0; const chunk='x'.repeat(512*1024);
    try{ for(let i=0;i<40;i++){ localStorage.setItem('filler'+i, chunk); mb+=0.5; } }
    catch(e){ return {mb, stoppedWith:String(e.name||e)}; }
    return {mb, stoppedWith:'never filled'};
  });
  console.log('storage filled to about', filled.mb, 'MB, stopped with:', filled.stoppedWith);

  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2200);
  const r=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
    const cv=document.querySelector('canvas'); let ink=0;
    if(cv){ const c=cv.getContext('2d'); const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
    return {objects:P&&(P.objects||[]).length, inkOnCanvas:ink,
            savedProjects:(()=>{ try{ return (localStorage['drawingmaster.projects.v1']||'').length; }
                                catch(e){ return 'unreadable'; } })()};
  });
  console.log('after import with a full store:', JSON.stringify(r));
  console.log('javascript errors:', errs.length);
  errs.slice(0,3).forEach(e=>console.log('  '+e));
  fs.writeFileSync('quota.png', await p.screenshot());
  await b.close();
})();
