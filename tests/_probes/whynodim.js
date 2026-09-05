/* Point this at a DXF and it says, for every piece of text that looks like a
   dimension value, whether STYLIZE recognised it - and if not, what the geometry
   beside it actually measures. That is the whole question: a value STYLIZE never
   recognised is a value it will never reformat. */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const DXF=process.argv[2];
if(!DXF){ console.log('usage: node tests/_probes/whynodim.js <file.dxf>'); process.exit(1); }
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2500);
  await p.click('#btnStylize'); await p.waitForTimeout(2800);
  const r=await p.evaluate(()=>{
    const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=pg.dxf||{};
    const num=s=>{ const m=/-?\d+(?:[.,]\d+)?/.exec(String(s).replace(/^\s*\d+\s*[xX]\s*/,''));
      return m? parseFloat(m[0].replace(',','.')) : null; };
    const looksLikeValue=t=>num(t.text)!=null && String(t.text).length<=14;
    const all=(d.texts||[]).filter(looksLikeValue);
    const modelled=new Set((d.dims||[]).map(m=>m.id));
    const owned=new Set((d.texts||[]).filter(t=>t._dim && modelled.has(t._dim)).map(t=>t.text));
    // how many filled arrowheads and how many 2-point strokes the file has
    return {
      unit: pg._report && pg._report.file,
      texts: all.length, models: (d.dims||[]).length,
      solids: (d.solids||[]).length,
      shortLines: (d.polys||[]).filter(q=>q.pts && q.pts.length===2).length,
      unmatched: all.map(t=>String(t.text)).filter(s=>!owned.has(s)).slice(0,20),
      matched: [...owned].slice(0,20),
    };
  });
  console.log(DXF);
  console.log('  value-looking texts: '+r.texts+'   dimensions recognised: '+r.models);
  console.log('  filled arrowheads (SOLID): '+r.solids+'   two-point strokes: '+r.shortLines);
  console.log('  recognised : '+JSON.stringify(r.matched));
  console.log('  NOT recognised: '+JSON.stringify(r.unmatched));
  await b.close();
})();
