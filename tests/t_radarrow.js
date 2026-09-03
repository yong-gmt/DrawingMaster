const {open,loadDxf}=require('./harness');
// Every arrowhead on a radius or diameter must: touch the arc with its tip, stand
// OUTSIDE the arc, and point in towards the centre.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      // read the DRAWN primitives, not the model
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id || !p._arrow || p.pts.length<2) return;
        const A=p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)]);
        const put=(tip,from)=>{
          const dTip=Math.hypot(tip[0]-m.centre[0], tip[1]-m.centre[1]);
          const dBody=Math.hypot(from[0]-m.centre[0], from[1]-m.centre[1]);
          out.push({id:m.id, kind:m.kind,
            tipOffArc:+Math.abs(dTip-m.radius).toFixed(4),
            bodyOutside:dBody>dTip+1e-6,
            pointsInward:((tip[0]-from[0])*(m.centre[0]-tip[0])
                        + (tip[1]-from[1])*(m.centre[1]-tip[1]))>0});
        };
        if(p._arrow.s) put(A[0],A[1]);
        if(p._arrow.e) put(A[A.length-1],A[A.length-2]);
      }));
    });
    return out;
  });
  console.log(dxf, JSON.stringify({arrowheads:r.length,
    tipNotOnArc:r.filter(x=>x.tipOffArc>0.001).length,
    bodyInsideTheArc:r.filter(x=>!x.bodyOutside).length,
    pointingAwayFromCentre:r.filter(x=>!x.pointsInward).length}));
  await b.close();
 }
})();
