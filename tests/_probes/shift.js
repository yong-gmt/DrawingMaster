const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const DXF=process.argv[2];
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2000);
  // what the FILE printed, before anything is restyled
  const before=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>o.push(String(t.text))));
    return o; });
  await p.evaluate(()=>{ const h=window.__hook(); h.store.format.decimals=2; });
  await p.click('#btnStylize'); await p.waitForTimeout(2200);
  const after=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>{ if(t._dim) o.push(String(t.text)); }));
    return o; });
  const num=s=>{ const m=/-?\d+(?:[.,]\d+)?/.exec(String(s).replace(/^\s*\d+\s*[xX]\s*/,''));
    return m? parseFloat(m[0].replace(',','.')) : null; };
  const bn=before.map(num).filter(v=>v!=null);
  let shifted=[];
  after.forEach(a=>{ const v=num(a); if(v==null) return;
    // did the file print this same value, at whatever precision it chose?
    const ok=before.some(s=>{ const w=num(s); if(w==null) return false;
      const dec=(String(s).split(/[.,]/)[1]||'').replace(/\D+$/,'').length;
      return +v.toFixed(dec)===w; });
    if(!ok) shifted.push(a); });
  console.log(DXF+':  dimensions after STYLIZE = '+after.length
    +'   values the file never printed (at any precision) = '+shifted.length
    +(shifted.length? '  '+JSON.stringify(shifted.slice(0,8)) : ''));
  await b.close();
})();
