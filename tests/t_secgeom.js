const {open,loadDxf}=require('./harness');
// A cutting plane is straight and square to the direction it is viewed from, its
// arrows point the way the file drew them, and the legs stand on the same side.
// Those four things together are what "not crooked, not backwards" means.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  const before=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.secs||[]).filter(s=>s.ok).map(s=>({letter:s.letter,
      views:s.ends.map(e=>e.view.map(v=>+v.toFixed(3)))}));
  });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(900);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.secs||[]).filter(s=>s.ok).map(s=>{
      const g=h.secGeomOf(s);
      const A=g.pts[1], B=g.pts[2];
      const L=Math.hypot(B[0]-A[0], B[1]-A[1])||1;
      const u=[(B[0]-A[0])/L, (B[1]-A[1])/L];
      const v=s.ends[0].view;
      // the drawn arrow caps, read back off the polyline
      let caps=null;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._sec!==s.id || !p._arrow || (p.pts||[]).length<4) return;
        const q=p.pts.map(z=>[z[0]+(o.dx||0), z[1]+(o.dy||0)]);
        const d0=[q[0][0]-q[1][0], q[0][1]-q[1][1]];
        const d1=[q[3][0]-q[2][0], q[3][1]-q[2][1]];
        const nz=(d)=>{ const m=Math.hypot(d[0],d[1])||1; return [d[0]/m, d[1]/m]; };
        caps=[nz(d0), nz(d1)];
      }));
      // the two legs must stand on the same side of the cut
      const nrm=[-u[1], u[0]];
      const side=(p)=>Math.sign(((p[0]-A[0])*nrm[0]+(p[1]-A[1])*nrm[1]).toFixed(6));
      /* and the arrowheads it was built from must not belong to a dimension:
         a dimension arrow that happens to line up is the thing that put markers
         in the wrong place, facing the wrong way. */
      let builtOnDimensionArrows=0;
      (P.dxf.solids||[]).forEach(sd=>{ if(sd._sec===s.id && sd._dim) builtOnDimensionArrows++; });
      return { letter:s.letter, builtOnDimensionArrows,
        squareToTheView:+Math.abs(u[0]*v[0]+u[1]*v[1]).toFixed(4),
        endsOffTheLineMM:+Math.abs((s.ends[1].p[0]-A[0])*nrm[0] +
                                   (s.ends[1].p[1]-A[1])*nrm[1]).toFixed(4),
        arrowsFollowTheFile: caps? caps.every(c=>c[0]*v[0]+c[1]*v[1] > 0.99) : null,
        legsOnTheSameSide: side(g.pts[0])===side(g.pts[3]) };
    });
  });
  console.log(dxf);
  r.forEach((x,i)=>console.log('   ', JSON.stringify(x),
    ' file said the view was', JSON.stringify(before[i] && before[i].views[0])));
  await b.close();
 }
})();
