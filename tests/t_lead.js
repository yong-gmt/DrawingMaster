const {open,loadDxf}=require('./harness');
// Drag the value a long way out and a long way back in. The leader has to follow
// all the way - no invisible ceiling - while the arrow stays put on the arc.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    let n=0, reachedFar=0, cameBack=0, broke=0, offArc=0;
    const lens=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      n++;
      const R=Math.hypot(m.centre[0]-m.point[0], m.centre[1]-m.point[1])||1;
      const u=[(m.point[0]-m.centre[0])/R, (m.point[1]-m.centre[1])/R];
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const pull=(len)=>{
        const g=h.dimModelGrips(P).find(x=>x.kind==='radial');
        const A=h.W2S(g.at[0],g.at[1]);
        const T=[m.point[0]+u[0]*len, m.point[1]+u[1]*len];
        const B=h.W2S(T[0],T[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        const g2=h.dimGeomOf(m), lead=g2.segs.find(s=>s.role==='lead');
        return {len:Math.hypot(lead.a[0]-lead.b[0], lead.a[1]-lead.b[1]), g:g2, lead};
      };
      const far=pull(70);                       // way outside the part
      lens.push(+far.len.toFixed(1));
      if(far.len>60) reachedFar++;
      const near=pull(8);                       // and back in close
      if(near.len<12) cameBack++;
      [far,near].forEach(s=>{
        const land=s.g.segs.find(x=>x.role==='land');
        if(Math.hypot(land.a[0]-s.lead.a[0], land.a[1]-s.lead.a[1])>0.001) broke++;
        offArc=Math.max(offArc, Math.abs(Math.hypot(
          s.lead.b[0]-m.centre[0], s.lead.b[1]-m.centre[1])-m.radius));
      });
    });
    return {dims:n, reachedFar, cameBack, landingLeftTheLeader:broke,
            arrowLeftTheArcMM:+offArc.toFixed(5),
            leaderAt70mmRequested:[Math.min(...lens), Math.max(...lens)]};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
