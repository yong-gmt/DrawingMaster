const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,150)));
  await loadDxf(pg,'Head-back.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    const layers={}; (d.polys||[]).forEach(p=>{ const k=(p._layer||'?')+(p._section?'[SEC]':'');
      layers[k]=(layers[k]||0)+1; });
    const kinds={}; (d.dims||[]).forEach(m=>{ kinds[m.kind+(m.ok?'':' NOT-OK')]=(kinds[m.kind+(m.ok?'':' NOT-OK')]||0)+1; });
    const labs=(d.texts||[]).filter(t=>/^[A-Z]'?$/.test(String(t.text).trim())).map(t=>t.text);
    return {polys:d.polys.length, texts:d.texts.length, solids:d.solids.length,
      hatches:d.hatches.length, marks:d.marks.length,
      dimTagged:(d.polys||[]).filter(p=>p._dim).length,
      models:(d.dims||[]).length, ok:(d.dims||[]).filter(m=>m.ok).length, kinds,
      secs:(d.secs||[]).length, letters:labs, layers,
      report:P._report&&P._report.skipped};
  });
  console.log(JSON.stringify(r,null,1));
  console.log('errors', errs.slice(0,3));
  await b.close();
})();
