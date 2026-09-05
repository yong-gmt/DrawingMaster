/* The shape in the screenshot: a dimension the program DID recognise, but whose
   printed number it could not tie to the geometry - a scaled drawing. The model
   then keeps the file's string as an override and prints it verbatim, for ever. */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  // force three models into the state a scaled file leaves them in
  await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ms=h.dimModels(pg);
    [['51',0],['R15',1],['41',2]].forEach(([s,i])=>{ const m=ms[i]; if(!m) return;
      m.text.prefix=null; m.text.suffix=null; m.text.override=s; });
    h.store.format.decimals=2; });
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  console.log('what those three dimensions draw: '+JSON.stringify(await p.evaluate(()=>{
    const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ms=h.dimModels(pg); const ids=new Set([ms[0],ms[1],ms[2]].filter(Boolean).map(m=>m.id));
    const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>{
      if(t._dim && ids.has(t._dim)) o.push(String(t.text)); }));
    return o; })));
  // and it must survive going down and back up, not become the rounding of a rounding
  for(const d of [0,3,2]){
    await p.evaluate(w=>{ const h=window.__hook(); h.store.format.decimals=w; }, d);
    await p.click('#btnStylize'); await p.waitForTimeout(1600);
    console.log('  decimals '+d+' -> '+JSON.stringify(await p.evaluate(()=>{
      const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
      const ms=h.dimModels(pg); const ids=new Set([ms[0],ms[1],ms[2]].filter(Boolean).map(m=>m.id));
      const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>{
        if(t._dim && ids.has(t._dim)) o.push(String(t.text)); }));
      return o; })));
  }
  // a real note must still pass through untouched
  await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=h.dimModels(pg)[3]; if(m){ m.text.prefix=null; m.text.suffix=null;
      m.text.override='M8 THRU'; } });
  await p.click('#btnStylize'); await p.waitForTimeout(1600);
  console.log('  a note stays a note: '+JSON.stringify(await p.evaluate(()=>{
    const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=h.dimModels(pg)[3]; if(!m) return null;
    const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>{
      if(t._dim===m.id) o.push(String(t.text)); }));
    return o; })));
  await b.close();
})();
