const {open,loadDxf}=require('./harness');
// The full user path for the radius run: STYLIZE, click the line that goes to the
// '+', drag its grip in and out. The value must not be resized by the drag, and
// the run must stay honest about where the centre is.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    let n=0, reachable=0, shrank=0, grew=0, sizeChanged=0, offArc=0, valueChanged=0, tooSmall=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').forEach(m=>{
      n++;
      const h0=m.text.h, v0=h.dimGeomOf(m).text.str;
      h.clearSelection();
      const g=h.dimGeomOf(m), cen=g.segs.find(s=>s.role==='cen');
      const mid=[(cen.pts[0][0]+cen.pts[cen.pts.length-1][0])/2,
                 (cen.pts[0][1]+cen.pts[cen.pts.length-1][1])/2];
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      const A=h.W2S(mid[0],mid[1]);
      ev('mousedown',A.x,A.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const gr=h.dimModelGrips(P).find(x=>x.kind==='radrun');
      if(!gr) return; reachable++;
      const u=[(m.centre[0]-m.point[0])/m.radius, (m.centre[1]-m.point[1])/m.radius];
      const pull=(len)=>{ const G=h.dimModelGrips(P).find(x=>x.kind==='radrun');
        const S1=h.W2S(G.at[0],G.at[1]);
        const T=[m.point[0]+u[0]*len, m.point[1]+u[1]*len];
        const S2=h.W2S(T[0],T[1]);
        ev('mousedown',S1.x,S1.y); ev('mousemove',S2.x,S2.y);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
      // a radius smaller than the shortest sensible run has nothing to shorten
      const canShorten=(m.radius > m.line.arrow*2 + 1);
      if(canShorten) tooSmall--; else tooSmall++;
      pull(Math.max(m.line.arrow*2.5, m.radius*0.5));
      let g2=h.dimGeomOf(m);
      const L1=Math.hypot(g2.centreAt[0]-m.point[0], g2.centreAt[1]-m.point[1]);
      if(!canShorten || L1 < m.radius-0.5) shrank++;
      pull(m.radius+5);
      g2=h.dimGeomOf(m);
      const L2=Math.hypot(g2.centreAt[0]-m.point[0], g2.centreAt[1]-m.point[1]);
      if(Math.abs(L2-m.radius)<0.01 && !g2.foreshortened) grew++;
      if(Math.abs(m.text.h-h0)>1e-6) sizeChanged++;
      if(g2.text.str!==v0) valueChanged++;
      offArc=Math.max(offArc, Math.abs(Math.hypot(
        g2.segs[0].b[0]-m.centre[0], g2.segs[0].b[1]-m.centre[1])-m.radius));
    });
    return {radials:n, tooSmallToShorten:Math.max(0,tooSmall), gripReachable:reachable, shortenedOk:shrank,
            backToTrueCentre:grew, valueResizedByDrag:sizeChanged,
            valueTextChanged:valueChanged, arrowOffArcMM:+offArc.toFixed(5)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
