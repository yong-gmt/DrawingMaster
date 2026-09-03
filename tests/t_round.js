const {open,loadDxf}=require('./harness');
// The polyline is the truth of what is drawn. If the circle we remembered does not
// pass through those very points, the exported CIRCLE/ARC is a different shape from
// the one on screen - which is exactly what "circles are distorted" means.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bad=[]; let n=0, worst=0, worstAng=0;
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(!p._round) return; n++;
      const R=p._round, dx=o.dx||0, dy=o.dy||0;
      const cx=R.cx+dx, cy=R.cy+dy;
      let e=0;
      p.pts.forEach(q=>{ e=Math.max(e, Math.abs(
        Math.hypot(q[0]+dx-cx, q[1]+dy-cy) - R.r)); });
      worst=Math.max(worst,e);
      // For an arc the real question is not "do the numbers match" but: does an
      // arc swept counter-clockwise from a0 to a1 actually cover the drawn points,
      // and no more? That is what the receiving CAD will draw.
      let ae=0;
      if(R.a0!=null){
        const A=(q)=>{ const a=Math.atan2(q[1]+dy-cy, q[0]+dx-cx)*180/Math.PI; return (a%360+360)%360; };
        const ccw=(f,t)=>((t-f)%360+360)%360;
        const span=ccw(R.a0, R.a1) || 360;
        let outside=0, maxIn=0;
        p.pts.forEach(q=>{ const t=ccw(R.a0, A(q));
          if(t>span+0.5) outside=Math.max(outside, Math.min(t-span, 360-t));
          else maxIn=Math.max(maxIn,t); });
        // points outside the sweep = the arc is drawn the wrong way round;
        // a sweep far longer than the points = the arc is drawn too long
        ae=Math.max(outside, span-maxIn);
        worstAng=Math.max(worstAng, ae);
      }
      if(e>0.02 || ae>0.5) bad.push({r:+R.r.toFixed(3), radiusErr:+e.toFixed(3),
        sweepErrDeg:+ae.toFixed(2), pts:p.pts.length});
    }));
    return {rounds:n, worstRadiusErrMM:+worst.toFixed(4),
            worstSweepErrDeg:+worstAng.toFixed(2), bad:bad.slice(0,5), nBad:bad.length};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
