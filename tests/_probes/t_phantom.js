const {open,loadDxf}=require('./harness');
// A cutting-plane line has to come out as a phantom line, and stay one through
// the export.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet3.dxf','Head-back.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const before=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[]; (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._sec) out.push(p.dash? p.dash.length : 0); }));
    return out;
  });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const lines=[];
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._sec && p.pts.length>=2) lines.push({dash:p.dash, n:p.pts.length}); }));
    const R=h.buildDXF(P);
    const lt=(R.text.match(/\nPHANTOM\r?\n/g)||[]).length;
    return {lines, phantomInFile:lt>0};
  });
  console.log(dxf);
  console.log('  before STYLIZE, dash on the cut line:', JSON.stringify(before));
  console.log('  after  STYLIZE                     :',
    JSON.stringify(r.lines.map(l=>l.dash)));
  console.log('  phantom pattern present in the export:', r.phantomInFile);
  await b.close();
 }
})();
