const {open,loadDxf}=require('./harness');
// Drag the ends of a section marker: the cut must get longer or shorter along its
// OWN line, never wander sideways, and the arrows must keep pointing the same way.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const out=[];
    (P.dxf.secs||[]).forEach(s=>{
      const ids=(P.objects||[]).filter(o=>o._sec===s.id).map(o=>o.id);
      h.setSelection(ids);
      const u=h.secAxis(s), n=[-u[1],u[0]];
      const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const len0=Math.abs(D(s.ends[1].p,u)-D(s.ends[0].p,u));
      const q0=D(s.ends[0].p,n);
      const view0=s.ends.map(e=>e.view.map(v=>Math.round(v)));
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      const grab=(kind,idx,target)=>{
        const g=h.secGrips(P).find(x=>x.kind===kind&&x.idx===idx); if(!g) return false;
        const A=h.W2S(g.at[0],g.at[1]), B=h.W2S(target[0],target[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); return true; };
      // pull end 0 out by 20mm along the cut
      const t0=D(s.ends[0].p,u), t1=D(s.ends[1].p,u), dir=(t0<t1)?-1:1;
      const want=[s.ends[0].p[0]+u[0]*20*dir, s.ends[0].p[1]+u[1]*20*dir];
      const okEnd=grab('end',0,want);
      const len1=Math.abs(D(s.ends[1].p,u)-D(s.ends[0].p,u));
      const drift=Math.max(Math.abs(D(s.ends[0].p,n)-q0), Math.abs(D(s.ends[1].p,n)-q0));
      // now the leg
      const leg0=s.leg;
      const E=s.ends[1], legTarget=[E.p[0]+E.view[0]*14, E.p[1]+E.view[1]*14];
      const okLeg=grab('leg',1,legTarget);
      const g=h.secGeomOf(s);
      const nrm=(v)=>{const L=Math.hypot(v[0],v[1])||1; return [Math.round(v[0]/L),Math.round(v[1]/L)];};
      out.push({id:s.id, gripsFound:okEnd&&okLeg,
        cutLenBefore:+len0.toFixed(1), cutLenAfter:+len1.toFixed(1),
        sidewaysDriftMM:+drift.toFixed(4),
        legBefore:+leg0.toFixed(1), legAfter:+s.leg.toFixed(1),
        viewBefore:view0, viewAfter:s.ends.map(e=>e.view.map(v=>Math.round(v))),
        arrowDirs:[nrm([g.pts[0][0]-g.pts[1][0], g.pts[0][1]-g.pts[1][1]]),
                   nrm([g.pts[3][0]-g.pts[2][0], g.pts[3][1]-g.pts[2][1]])]});
    });
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
