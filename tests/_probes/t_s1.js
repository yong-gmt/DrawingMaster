const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const layers={}; (P.dxf.polys||[]).forEach(p=>{ const k=(p._layer||'?')+(p._section?' [SEC]':'');
      layers[k]=(layers[k]||0)+1; });
    const secs=(P.dxf.polys||[]).filter(p=>p._section).map(p=>({layer:p._layer,n:p.pts.length,
      a:p.pts[0].map(v=>+v.toFixed(2)), b:p.pts[p.pts.length-1].map(v=>+v.toFixed(2))}));
    const labs=(P.dxf.texts||[]).filter(t=>/^[A-Z]'?$/.test(String(t.text).trim()))
      .map(t=>({t:t.text,x:+t.x.toFixed(2),y:+t.y.toFixed(2)}));
    const solids=(P.dxf.solids||[]).map(sd=>sd.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]));
    return {layers, secs, labs, solids};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
