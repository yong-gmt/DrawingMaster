const {open,loadDxf}=require('./harness');
// A radius: leader in from outside, arrowhead standing OUTSIDE the arc with its
// tip on it and pointing IN towards the centre, a run on to the centre mark, and a
// landing carrying the value. A diameter is the same on both sides.
const CHECK=()=>{
  const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
  const PXMM=96/25.4; const out=[];
  const cc=document.createElement('canvas').getContext('2d');
  cc.font='100px '+h.store.format.font+',Arial';
  (pg.dxf.dims||[]).filter(m=>m.ok && (m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
    const g=h.dimGeomOf(m);
    const lead=g.segs.find(s=>s.role==='lead'), land=g.segs.find(s=>s.role==='land');
    const cen=g.segs.find(s=>s.role==='cen');
    const tip=lead.b, elbow=lead.a;
    // the arrowhead terminates the leader, on the arc
    const aTip=lead.b, aFrom=lead.a;
    const onArc=Math.abs(Math.hypot(aTip[0]-m.centre[0],aTip[1]-m.centre[1])-m.radius);
    // ...standing outside it, pointing in
    const outward=((aTip[0]-aFrom[0])*(m.centre[0]-aTip[0])+(aTip[1]-aFrom[1])*(m.centre[1]-aTip[1]))>0
              && Math.hypot(aFrom[0]-m.centre[0],aFrom[1]-m.centre[1])>m.radius;
    // leader collinear with the centre?
    const d1=[tip[0]-m.centre[0], tip[1]-m.centre[1]], d2=[elbow[0]-m.centre[0], elbow[1]-m.centre[1]];
    const cross=Math.abs(d1[0]*d2[1]-d1[1]*d2[0])/(Math.hypot(...d1)*Math.hypot(...d2)||1);
    // the elbow must be OUTSIDE the arc, so the leader leaves the part cleanly
    const outside=Math.hypot(...d2)>m.radius;
    // one arrowhead for a radius, two for a diameter - and it must sit on the arc
    const arrows=g.segs.reduce((n,s)=>n+((s.arrow?(s.arrow.s?1:0)+(s.arrow.e?1:0):0)),0);
    const wantArrows=(m.kind==='diameter')?2:1;
    const landFlat=Math.abs(land.a[1]-land.b[1]);
    const desc=Math.max(0,cc.measureText(String(g.text.str)).actualBoundingBoxDescent)*m.text.h/100;
    const gapPx=(g.text.y-land.a[1]-desc)*PXMM;   // clear space, not baseline
    const centred=Math.abs(g.text.x-(land.a[0]+land.b[0])/2);
    out.push({id:m.id, outward, onArcMM:+onArc.toFixed(4), radialErr:+cross.toFixed(5),
      elbowOutside:outside, arrowheads:arrows, wantArrows, landTiltMM:+landFlat.toFixed(5),
      gapPx:+gapPx.toFixed(2), textOffCentreMM:+centred.toFixed(4), rot:g.text.rot});
  });
  return out;
};
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(CHECK);
  const f=(k)=>r.map(x=>x[k]);
  console.log(dxf, JSON.stringify({n:r.length,
    arrowOffArcMM:+Math.max(...f('onArcMM')).toFixed(4),
    notOnRadius:r.filter(x=>x.radialErr>1e-4).length,
    arrowNotPointingInFromOutside:r.filter(x=>!x.outward).length,
    elbowInsideArc:r.filter(x=>!x.elbowOutside).length,
    wrongArrowCount:r.filter(x=>x.arrowheads!==x.wantArrows).length,
    landingNotHorizontal:r.filter(x=>x.landTiltMM>1e-6).length,
    gapPx:[Math.min(...f('gapPx')),Math.max(...f('gapPx'))],
    textOffCentreMM:+Math.max(...f('textOffCentreMM')).toFixed(4),
    textNotHorizontal:r.filter(x=>x.rot!==0).length}));
  await b.close();
 }
})();
