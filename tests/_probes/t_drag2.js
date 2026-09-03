const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(); const P=h.activePage();
    const out=[];
    (h.dimModels(P)||[]).filter(m=>m.ok).forEach(m=>{
      const u=m.dir,n=[-u[1],u[0]],D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const S={q1:D(m.measure.p1,n), q2:D(m.measure.p2,n)};
      out.push({id:m.id, q:+m.line.q.toFixed(2), q1:+S.q1.toFixed(2), q2:+S.q2.toFixed(2),
        gap:m.ext.gap.map(x=>+x.toFixed(2)), over:m.ext.overshoot.map(x=>+x.toFixed(2)),
        vis:m.ext.visible, mode:(m.line.inside?'mid':'')+(m.line.arrowsOut?'/out':'')});
    });
    return out;
  });
  console.log(r.filter(x=>Math.abs(x.q-x.q1)<x.gap[0]+1 || Math.abs(x.q-x.q2)<x.gap[1]+1).length, 'tight');
  console.log(JSON.stringify(r.slice(0,6)));
  const g=await pg.evaluate(()=>{
    const h=window.__hook(); const P=h.activePage();
    const m=h.dimModelById(P,'dim29');
    if(!m) return 'no model';
    const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
    h.setSelection(ids);
    return {grips:h.dimModelGrips(P).map(x=>x.kind), geom:h.dimGeomOf(m).segs.map(s=>s.hidden?'-':'seg'), ids:ids.length};
  });
  console.log('dim29', JSON.stringify(g));
  await b.close();
})();
