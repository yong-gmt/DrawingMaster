const {open,loadDxf}=require('./harness');
// Pull the value far away from its circle and check the whole dimension follows:
// landing joins the leader, leader stays radial, arrow stays on the arc, and the
// centre mark stays on the real centre.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='radial'); if(!grip) return;
      const A=h.W2S(grip.at[0],grip.at[1]);
      // drag the value a long way down-left, as in the picture
      ev('mousedown',A.x,A.y); ev('mousemove',A.x-260,A.y+200);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const g=h.dimGeomOf(m);
      const lead=g.segs.find(s=>s.role==='lead'), land=g.segs.find(s=>s.role==='land');
      const cen=g.segs.find(s=>s.role==='cen');
      const u=[(m.centre[0]-m.point[0])/m.radius, (m.centre[1]-m.point[1])/m.radius];
      out.push({id:m.id, val:String(m.text.override||m.text.value),
        leaderMM:+Math.hypot(lead.a[0]-lead.b[0], lead.a[1]-lead.b[1]).toFixed(1),
        // the landing has to start exactly where the leader ends
        landingJoinsLeader:+Math.hypot(land.a[0]-lead.a[0], land.a[1]-lead.a[1]).toFixed(4),
        // the leader must still lie on the true radius
        leaderOffRadius:+Math.abs((lead.a[0]-m.point[0])*u[1]-(lead.a[1]-m.point[1])*u[0]).toFixed(4),
        arrowOffArc:+Math.abs(Math.hypot(lead.b[0]-m.centre[0], lead.b[1]-m.centre[1])-m.radius).toFixed(4),
        markOffCentre:+Math.hypot(g.centreAt[0]-m.centre[0], g.centreAt[1]-m.centre[1]).toFixed(3),
        foreshortened:g.foreshortened});
    });
    return out;
  });
  console.log(JSON.stringify(r,null,0));
  const bad=r.filter(x=>x.landingJoinsLeader>0.001||x.leaderOffRadius>0.001||x.arrowOffArc>0.001);
  console.log('broken after pulling the value away:', bad.length, bad.slice(0,3));
  console.log('centre mark off the true centre (max):',
    Math.max(...r.map(x=>x.markOffCentre)).toFixed(3), 'mm');
  await b.close();
})();
