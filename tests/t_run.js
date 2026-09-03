const {open,loadDxf}=require('./harness');
// Stretch the run to the centre the way a user would: click anywhere on that line,
// drag it in, drag it back out. Across every file, every radius and diameter.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    let n=0, grabbed=0, shortened=0, restored=0, offArc=0, offRadius=0, valueChanged=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      n++;
      const v0=h.dimGeomOf(m).text.str;
      const u=[(m.centre[0]-m.point[0])/m.radius, (m.centre[1]-m.point[1])/m.radius];
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      // grab the run somewhere along its length, not at the cross
      const g=h.dimGeomOf(m), cen=g.segs.find(s=>s.role==='cen');
      const a=cen.pts[0], b2=cen.pts[cen.pts.length-1];
      const grab=[a[0]*0.6+b2[0]*0.4, a[1]*0.6+b2[1]*0.4];
      const drag=(to)=>{ const A=h.W2S(grab[0],grab[1]);
        const T=[m.point[0]+u[0]*to, m.point[1]+u[1]*to];
        const B=h.W2S(T[0],T[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
      const before=Math.hypot(g.centreAt[0]-m.point[0], g.centreAt[1]-m.point[1]);
      drag(Math.max(m.line.arrow*2.2, m.radius*0.45));
      let g2=h.dimGeomOf(m);
      const mid=Math.hypot(g2.centreAt[0]-m.point[0], g2.centreAt[1]-m.point[1]);
      if(Math.abs(mid-before)>0.2 || m.radius<=m.line.arrow*2+1) { grabbed++; }
      if(mid<before-0.2 || m.radius<=m.line.arrow*2+1) shortened++;
      // ends of the run must stay on the true radial line, arrow still on the arc
      const c2=g2.segs.find(s=>s.role==='cen');
      [c2.pts[0], c2.pts[c2.pts.length-1]].forEach(q=>{
        const vx=q[0]-m.point[0], vy=q[1]-m.point[1];
        offRadius=Math.max(offRadius, Math.abs(-vx*u[1]+vy*u[0])); });
      offArc=Math.max(offArc, Math.abs(Math.hypot(
        c2.pts[c2.pts.length-1][0]-m.centre[0],
        c2.pts[c2.pts.length-1][1]-m.centre[1])-m.radius));
      // and back out to the true centre
      const g3=h.dimGeomOf(m), c3=g3.segs.find(s=>s.role==='cen');
      const a3=c3.pts[0], b3=c3.pts[c3.pts.length-1];
      const grab3=[a3[0]*0.6+b3[0]*0.4, a3[1]*0.6+b3[1]*0.4];
      { const A=h.W2S(grab3[0],grab3[1]);
        const T=[m.point[0]+u[0]*(m.radius+4)];
        const B=h.W2S(m.point[0]+u[0]*(m.radius+4), m.point[1]+u[1]*(m.radius+4));
        ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }
      const g4=h.dimGeomOf(m);
      if(!g4.foreshortened && m.run.len==null) restored++;
      if(g4.text.str!==v0) valueChanged++;
    });
    return {radialOrDiameter:n, grabbedByItsLine:grabbed, shortened, restoredToTrueCentre:restored,
            valueChangedByDragging:valueChanged,
            arrowLeftTheArcMM:+offArc.toFixed(5), runLeftTheRadiusMM:+offRadius.toFixed(4)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
