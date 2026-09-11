const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// The whole flow a person actually uses, in ONE browser that keeps its storage:
// open, import, go back, reload the page, open the project again.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  const look=async(tag)=>{
    const r=await p.evaluate(()=>{
      const h=window.__hook&&window.__hook();
      if(!h||!h.store) return {noStore:true};
      const P=h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
      const cv=document.querySelector('canvas');
      let ink=0;
      if(cv){ const c=cv.getContext('2d');
        const d=c.getImageData(0,0,cv.width,cv.height).data;
        for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
      return {page:P&&P.name, objects:P&&(P.objects||[]).length,
              dims:P&&P.dxf&&(P.dxf.dims||[]).length,
              editorVisible: !document.querySelector('#editor').classList.contains('hide'),
              inkOnCanvas:ink};
    });
    console.log('  '+tag, JSON.stringify(r));
    return r;
  };
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  await look('empty sheet      :');
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  await look('after import     :');
  fs.writeFileSync(require('./harness').out('real_1.png'), await p.screenshot());

  // back to the dashboard, then RELOAD the page, then open the project again
  const back=await p.$('#btnBack'); if(back && await back.isVisible()) await back.click();
  else await p.evaluate(()=>window.__hook().goDashboard&&window.__hook().goDashboard());
  await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(1200);
  fs.writeFileSync(require('./harness').out('real_2.png'), await p.screenshot());
  const cards=await p.$$('text=Project 1');
  console.log('  project on the dashboard after a reload:', cards.length>0);
  if(cards.length){ await cards[0].click(); await p.waitForTimeout(1500);
    const sh2=await p.$('text=Sheet 01'); if(sh2&&await sh2.isVisible()) await sh2.click();
    await p.waitForTimeout(800);
    await look('after reopening  :');
    fs.writeFileSync(require('./harness').out('real_3.png'), await p.screenshot()); }
  console.log('  javascript errors:', errs.length);
  errs.slice(0,4).forEach(e=>console.log('    '+e));
  await b.close();
})();
