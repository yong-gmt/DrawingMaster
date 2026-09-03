const _p=require('path');
const {chromium}=require('./_pw');
const path=require('path');
// How much room does one imported drawing take in the browser's store? The store
// is about 5 MB in total, and it is shared by every project.
(async()=>{
  const b=await chromium.launch();
  for(const file of [_p.join(require('./harness').ROOT,'src','base.html'),require('./harness').APP]){
    const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
    await p.goto('file://'+require('./harness').fixture(file)); await p.waitForTimeout(900);
    const sizes=[];
    for(let k=0;k<6;k++){
      await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(500);
      const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
      await p.waitForTimeout(400);
      await p.click('#btnImport');
      await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
      await p.waitForTimeout(1600);
      const r=await p.evaluate(()=>{
        let bytes=-1, err=null;
        try{ bytes=(localStorage['drawingmaster.projects.v1']||'').length; }catch(e){ err=String(e); }
        return {bytes, err};
      });
      sizes.push(r.bytes);
      if(r.err){ console.log('  storage error at project', k+1, r.err); break; }
      // back to the dashboard so the next project starts clean
      await p.evaluate(()=>{ const h=window.__hook(); h.goDashboard&&h.goDashboard(); });
      await p.waitForTimeout(400);
    }
    console.log(file, 'store size after each import:', sizes.map(v=>(v/1024).toFixed(0)+'KB').join(' -> '));
    console.log('  javascript errors:', errs.length, errs.slice(0,2));
    await p.context().close();
  }
  await b.close();
})();
