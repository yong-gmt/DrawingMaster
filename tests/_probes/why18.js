const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('dec_inch.dxf'));
  await p.waitForTimeout(2200);
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const tb=h.tbRect();
    const out=[];
    (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>{
      const x=t.x+(ob.dx||0), y=t.y+(ob.dy||0);
      out.push({text:String(t.text), at:[+x.toFixed(1),+y.toFixed(1)],
        inTitleBand: x>=tb.x&&x<=tb.x+170&&y>=tb.y&&y<=tb.y+24.68,
        num0:t._num0==null?null:t._num0}); }));
    return {tb:[+tb.x.toFixed(1),+tb.y.toFixed(1)], texts:out}; }),null,1));
  await b.close();
})();
