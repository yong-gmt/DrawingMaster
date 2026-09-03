const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    return {
      secLines:(d.polys||[]).filter(p=>p._section).map(p=>({n:p.pts.length,
        a:p.pts[0].map(v=>+v.toFixed(1)), b:p.pts[p.pts.length-1].map(v=>+v.toFixed(1)),
        len:+Math.hypot(p.pts[p.pts.length-1][0]-p.pts[0][0],p.pts[p.pts.length-1][1]-p.pts[0][1]).toFixed(1),
        sec:p._sec||null, dash:!!p.dash})),
      solids:(d.solids||[]).map(sd=>({pts:sd.map(q=>[+q[0].toFixed(1),+q[1].toFixed(1)]), sec:sd._sec||null})),
      letters:(d.texts||[]).filter(t=>/^[A-Z]'?$/.test(String(t.text).trim()))
        .map(t=>({t:t.text, x:+t.x.toFixed(1), y:+t.y.toFixed(1), h:+t.h.toFixed(1), sec:t._sec||null})),
      secs:(d.secs||[]).map(s=>({letter:s.letter, ends:s.ends.map(e=>[e.p.map(v=>+v.toFixed(1)), e.view.map(v=>+v.toFixed(2))])}))
    };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
