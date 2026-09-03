const {open,loadDxf}=require('./harness');
(async()=>{
 for(const f of ['edge_mm.dxf','edge_in.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,90)));
  await loadDxf(pg,f);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {models:(P.dxf.dims||[]).map(m=>({kind:m.kind, ok:m.ok,
              value:String(m.text&&(m.text.override!=null?m.text.override:m.text.value)),
              r:m.radius?+m.radius.toFixed(2):null})),
            explodedDimStrokesLeft:(P.dxf.polys||[]).filter(p=>/Dimension/i.test(p._layer||'')&&!p._dim).length};
  });
  console.log(f, JSON.stringify(r), 'errors', errs.length);
  await b.close();
 }
})();
