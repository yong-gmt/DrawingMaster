const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// Make SAVING fail, the way a full or blocked store does, and see what the app
// does about it.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  await p.evaluate(()=>{
    const real=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(String(k).indexOf('drawingmaster')===0){
        const e=new Error('quota'); e.name='QuotaExceededError'; throw e; }
      return real.apply(this,arguments); };
  });
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2200);
  const r=await p.evaluate(()=>{
    const h=window.__hook&&window.__hook();
    const P=h&&h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
    const cv=document.querySelector('canvas'); let ink=0;
    if(cv){ const c=cv.getContext('2d'); const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
    return {objects:P?(P.objects||[]).length:'no page', inkOnCanvas:ink,
            toast:(document.querySelector('#toast')||{}).textContent};
  });
  console.log('with saving blocked, after import:', JSON.stringify(r));
  console.log('javascript errors:', errs.length);
  errs.slice(0,3).forEach(e=>console.log('  '+e));
  fs.writeFileSync('saveflail.png', await p.screenshot());
  await b.close();
})();
