const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const layers={};
    (P.dxf.polys||[]).forEach(p=>{ const k=(p._layer||'?')+(p._section?' [SEC]':'');
      layers[k]=(layers[k]||0)+1; });
    const secs=(P.dxf.polys||[]).filter(p=>p._section).map(p=>({
      layer:p._layer, n:p.pts.length,
      a:p.pts[0].map(v=>+v.toFixed(2)), b:p.pts[p.pts.length-1].map(v=>+v.toFixed(2)),
      len:+Math.hypot(p.pts[p.pts.length-1][0]-p.pts[0][0], p.pts[p.pts.length-1][1]-p.pts[0][1]).toFixed(2)
    }));
    const labs=(P.dxf.texts||[]).filter(t=>/^[A-H]'?$/.test(String(t.text).trim()))
      .map(t=>({t:t.text, x:+t.x.toFixed(2), y:+t.y.toFixed(2), rot:t.rot, h:t.h}));
    const solids=(P.dxf.solids||[]).map(sd=>{ let cx=0,cy=0; sd.forEach(p=>{cx+=p[0];cy+=p[1];});
      return {c:[+(cx/sd.length).toFixed(2),+(cy/sd.length).toFixed(2)], n:sd.length}; });
    return {layers, secs, labs, solidCount:solids.length, solids};
  });
  console.log(JSON.stringify(r,null,1).slice(0,4000));
  await b.close();
})();
