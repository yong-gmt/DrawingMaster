const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// A sheet is a sheet of paper: importing a second drawing puts it next to the
// first, it does not throw the first away.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  const look=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf||{};
    const bb=h.entitiesBBox(P);
    return {strokes:(d.polys||[]).length, texts:(d.texts||[]).length,
            dimensions:(d.dims||[]).length, markers:(d.secs||[]).length,
            ids:new Set((d.dims||[]).map(m=>m.id)).size,
            box:[+bb.minx.toFixed(0),+bb.miny.toFixed(0),+bb.maxx.toFixed(0),+bb.maxy.toFixed(0)]};
  });
  const imp=async(f)=>{ await p.click('#btnImport');
    await p.setInputFiles('#fileInput', H.fixture(f)); await p.waitForTimeout(2000); };

  await imp('Head-back.dxf');
  const a=await look(); console.log('after the first file :', JSON.stringify(a));
  await imp('Body_Demo_Drawing_Sheet1.dxf');
  const b2=await look(); console.log('after the second     :', JSON.stringify(b2));
  await imp('Body_Demo_Drawing_Sheet3.dxf');
  const c=await look(); console.log('after the third      :', JSON.stringify(c));

  console.log('the first drawing is still there   :', c.strokes>a.strokes && c.dimensions>a.dimensions);
  console.log('every dimension id is still unique :', c.ids===c.dimensions);
  console.log('nothing landed on top of the first :', c.box[2]>a.box[2] || c.box[1]<a.box[1]);

  // and STYLIZE must handle the whole sheet, not just one drawing
  await p.click('#btnStylize'); await p.waitForTimeout(1500);
  const styled=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+((h.store.format.fontSize||10)*25.4/72).toFixed(3);
    let vals=0, wrong=0;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!t._dim) return; vals++; if(Math.abs(t.h-want)>0.01) wrong++; }));
    return {dimensionValues:vals, atTheWrongSize:wrong};
  });
  console.log('STYLIZE across all three drawings  :', JSON.stringify(styled));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
