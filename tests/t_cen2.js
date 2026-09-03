const {open,loadDxf}=require('./harness');
// Every radius must show its centre and be joined to it.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  // Import no longer redraws anything - that is STYLIZE's job now - so press it
  // before asking what the drawing is made of.
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const res=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').forEach(m=>{
      const g=h.dimGeomOf(m);
      const cen=g.segs.find(s=>s.role==='cen');
      const mH=g.segs.find(s=>s.role==='mkH'), mV=g.segs.find(s=>s.role==='mkV');
      // the run reads outwards: it starts at the centre mark and its arrowhead
      // lands exactly on the arc
      const first=cen.pts[0], last=cen.pts[cen.pts.length-1];
      const startAtArc=Math.hypot(last[0]-m.point[0], last[1]-m.point[1]);
      const endsAtMark=Math.hypot(first[0]-g.centreAt[0], first[1]-g.centreAt[1]);
      const mkCross=Math.hypot((mH.a[0]+mH.b[0])/2-g.centreAt[0], (mV.a[1]+mV.b[1])/2-g.centreAt[1]);
      const trueCen=Math.hypot(g.centreAt[0]-m.centre[0], g.centreAt[1]-m.centre[1]);
      // the prim really is in the drawing, not just in the model
      let drawn=0;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim===m.id && ['cen','mkH','mkV'].includes(p._role) && p.pts.length>=2) drawn++; }));
      res.push({id:m.id, far:g.foreshortened, startAtArc, endsAtMark, mkCross, trueCen, drawn});
    });
    return res;
  });
  console.log(dxf, JSON.stringify({n:r.length,
    missingCentreParts:r.filter(x=>x.drawn!==3).length,
    runNotStartingOnArcMM:+Math.max(...r.map(x=>x.startAtArc)).toFixed(4),
    runNotReachingMarkMM:+Math.max(...r.map(x=>x.endsAtMark)).toFixed(4),
    markNotOnCentreMM:+Math.max(...r.map(x=>x.mkCross)).toFixed(4),
    foreshortened:r.filter(x=>x.far).length,
    markAwayFromTrueCentreMM:+Math.max(...r.map(x=>x.trueCen)).toFixed(4)}));
  await b.close();
 }
})();
