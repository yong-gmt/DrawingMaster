const {open,loadDxf}=require('./harness');
// Can a REBUILT radius be dragged the same way a declared one can?
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'exploded.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    let n=0, grips=0, moved=0, joined=0, offArc=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      n++;
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const g=h.dimModelGrips(P).find(x=>x.kind==='radial');
      if(!g) return; grips++;
      const R=Math.hypot(m.centre[0]-m.point[0], m.centre[1]-m.point[1])||1;
      const u=[(m.point[0]-m.centre[0])/R, (m.point[1]-m.centre[1])/R];
      const before=h.dimGeomOf(m);
      const T=[m.point[0]+u[0]*45, m.point[1]+u[1]*45];
      const A=h.W2S(g.at[0],g.at[1]), B=h.W2S(T[0],T[1]);
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const g2=h.dimGeomOf(m);
      const lead=g2.segs.find(s=>s.role==='lead'), land=g2.segs.find(s=>s.role==='land');
      const len=Math.hypot(lead.a[0]-lead.b[0], lead.a[1]-lead.b[1]);
      if(len>35) moved++;
      if(Math.hypot(land.a[0]-lead.a[0], land.a[1]-lead.a[1])<0.001) joined++;
      offArc=Math.max(offArc, Math.abs(Math.hypot(
        lead.b[0]-m.centre[0], lead.b[1]-m.centre[1])-m.radius));
    });
    return {rebuiltRadialOrDiameter:n, haveTheGrip:grips,
            leaderStretched:moved, landingStayedJoined:joined,
            arrowLeftTheArcMM:+offArc.toFixed(5)};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
