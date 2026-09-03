const {open,loadDxf}=require('./harness');
// Drag the VALUE of a radius wherever the cursor goes - not along a convenient
// axis - and see whether the value follows and the line stretches after it.
(async()=>{
 for(const dxf of ['Head-back.dxf','exploded.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    const miss=[];
    let n=0, joined=0, offLanding=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      [[70,-50],[-80,60],[40,90],[-60,-70]].forEach(([dx,dy])=>{
        const g=h.dimModelGrips(P).find(x=>x.kind==='radial'); if(!g) return;
        n++;
        const A=h.W2S(g.at[0],g.at[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',A.x+dx,A.y+dy);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        const g2=h.dimGeomOf(m);
        // where the cursor ended, in world millimetres
        const w=h.S2W(A.x+dx, A.y+dy); const want=[w.x,w.y];
        const lead=g2.segs.find(s=>s.role==='lead'), land=g2.segs.find(s=>s.role==='land');
        if(Math.hypot(land.a[0]-lead.a[0], land.a[1]-lead.a[1])<0.001) joined++;
        /* What the drag controls is the LANDING - the elbow slides along the
           radius to the cursor's height and the landing runs out to it. The value
           then sits on that landing at its locked gap, which is a fixed offset,
           not a miss. So measure the landing, and check the value separately. */
        const R=Math.hypot(m.centre[0]-m.point[0], m.centre[1]-m.point[1])||1;
        const uy=(m.point[1]-m.centre[1])/R;
        /* ...and the leader only runs OUTWARDS from the arc. A cursor on the far
           side of the arc asks for a negative leader, which is not a place a radius
           can put its value; the closest reachable point is the right answer there.
           So the demand is made only where the drag was actually reachable. */
        const need=(want[1]-m.point[1])/uy;
        if(want && Math.abs(uy)>0.05 && need>(m.text.h||2.5)*1.6){
          const d=Math.abs(g2.elbow[1]-want[1]);
          if(d>0.2) miss.push(+d.toFixed(2)); }   // 0.2mm = one mouse pixel
        const lo=Math.min(g2.elbow[0], g2.landEnd[0])-0.01;
        const hi=Math.max(g2.elbow[0], g2.landEnd[0])+0.01;
        if(g2.text.x<lo || g2.text.x>hi) offLanding++;
      });
    });
    return {drags:n, landingStayedJoined:joined,
            landingDidNotReachTheCursor:miss.length,
            worstMissMM:miss.length? Math.max(...miss):0,
            valueOffItsOwnLanding:offLanding};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
