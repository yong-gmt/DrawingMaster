const {open,loadDxf}=require('./harness');
// Ground truth: a radius or diameter dimension must sit on a real round feature.
// So for every one, look for a drawn arc whose points really are m.radius away
// from where the '+' was put. If none exists, the '+' is in the wrong place.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const arcs=[];
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._dim||p._sec||p.pts.length<5) return;
      arcs.push(p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)])); }));
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      const g=h.dimGeomOf(m), C=g.centreAt;
      // best matching arc: all its points the same distance from C, and that
      // distance equal to the dimension's own radius
      let best=1e9;
      arcs.forEach(A=>{
        const ds=A.map(q=>Math.hypot(q[0]-C[0], q[1]-C[1]));
        const lo=Math.min(...ds), hi=Math.max(...ds);
        if(hi-lo>0.25) return;                       // not concentric with C
        best=Math.min(best, Math.abs((lo+hi)/2 - m.radius));
      });
      out.push({id:m.id, kind:m.kind, val:String(m.text.override||m.text.value),
                r:+m.radius.toFixed(2), missMM:+best.toFixed(3)});
    });
    return out;
  });
  const bad=r.filter(x=>x.missMM>0.3);
  console.log(dxf, 'dims', r.length, '| centre marks NOT on a real arc of that radius:', bad.length,
              JSON.stringify(bad.slice(0,5)));
  await b.close();
 }
})();
