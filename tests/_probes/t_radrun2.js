const {open,loadDxf}=require('./harness');
// Reach the centre run the way a user does: click the line that runs to the '+',
// then look for a grip on it - after STYLIZE, which is when they were trying.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    let n=0, selected=0, gripThere=0, dragWorked=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').forEach(m=>{
      n++;
      h.clearSelection();
      const g=h.dimGeomOf(m);
      const cen=g.segs.find(s=>s.role==='cen');
      const mid=[(cen.pts[0][0]+cen.pts[cen.pts.length-1][0])/2,
                 (cen.pts[0][1]+cen.pts[cen.pts.length-1][1])/2];
      const A=h.W2S(mid[0],mid[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const sel=[...h.selIds].map(i=>h.objById(i)).filter(Boolean);
      if(sel.some(o=>o._dim===m.id)) selected++;
      const gr=h.dimModelGrips(P).find(x=>x.kind==='radrun');
      if(gr) gripThere++; else return;
      const u=[(m.centre[0]-m.point[0])/m.radius, (m.centre[1]-m.point[1])/m.radius];
      const T=[m.point[0]+u[0]*m.radius*0.45, m.point[1]+u[1]*m.radius*0.45];
      const S1=h.W2S(gr.at[0],gr.at[1]), S2=h.W2S(T[0],T[1]);
      ev('mousedown',S1.x,S1.y); ev('mousemove',S2.x,S2.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const g2=h.dimGeomOf(m);
      const L=Math.hypot(g2.centreAt[0]-m.point[0], g2.centreAt[1]-m.point[1]);
      if(L < m.radius-1) dragWorked++;
    });
    return {radials:n, selectedByClickingTheRun:selected, gripPresent:gripThere, dragShortenedIt:dragWorked};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
