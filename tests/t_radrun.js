const {open,loadDxf}=require('./harness');
// Drag the centre mark along the radius: the run must follow, the arrowhead must
// stay on the arc, the run must stay on the true radial line, and pulling it back
// out to the real centre must switch the foreshortening off again.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    let n=0, shortened=0, jogged=0, restored=0, offArc=0, offRadius=0, gripMissing=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').forEach(m=>{
      n++;
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='radrun');
      if(!grip){ gripMissing++; return; }
      const u=[(m.centre[0]-m.point[0])/m.radius, (m.centre[1]-m.point[1])/m.radius];
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      const drag=(from,toLen)=>{ const A=h.W2S(from[0],from[1]);
        const T=[m.point[0]+u[0]*toLen, m.point[1]+u[1]*toLen];
        const B=h.W2S(T[0],T[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
      // pull it in to 40% of the radius
      drag(grip.at, m.radius*0.4);
      let g=h.dimGeomOf(m);
      const runLen=Math.hypot(g.centreAt[0]-m.point[0], g.centreAt[1]-m.point[1]);
      if(runLen < m.radius-1) shortened++;
      if(g.foreshortened) jogged++;
      offArc=Math.max(offArc, Math.abs(Math.hypot(
        g.segs[0].b[0]-m.centre[0], g.segs[0].b[1]-m.centre[1])-m.radius));
      // the ends of the run must stay on the true radial line (the zig-zag in the
      // middle leaves it on purpose - that is the "not to scale" symbol)
      const cen=g.segs.find(s=>s.role==='cen');
      [cen.pts[0], cen.pts[cen.pts.length-1]].forEach(q=>{
        const vx=q[0]-m.point[0], vy=q[1]-m.point[1];
        offRadius=Math.max(offRadius, Math.abs(-vx*u[1]+vy*u[0])); });
      // push it back out past the true centre
      const g2=h.dimGeomOf(m);
      drag(g2.centreAt, m.radius+3);
      g=h.dimGeomOf(m);
      if(!g.foreshortened && m.run.len==null) restored++;
    });
    return {radials:n, gripMissing, shortened, foreshortenedWhenShort:jogged,
      restoredWhenPulledOut:restored,
      arrowOffArcMM:+offArc.toFixed(5), runOffRadiusMM:+offRadius.toFixed(3)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
