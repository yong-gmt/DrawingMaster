const {open,loadDxf}=require('./harness');
// The same drawing, drawn the way a different program or draughtsman might have
// drawn it: turned, mirrored, larger, smaller. The right answer is known - it is
// the answer for the original - so anything that changes is a rule that only
// worked because of how the sample files happened to be drawn.
const WANT={dims:33, secs:1, markerLetter:'A'};
(async()=>{
  const files=['Head-back.dxf','var_rot30.dxf','var_rot90.dxf','var_mirror.dxf',
               'var_scaled.dxf','var_tiny.dxf'];
  for(const f of files){
    const {b,pg}=await open('DrawingMaster.html');
    const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,90)));
    await loadDxf(pg,f);
    await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    await pg.waitForTimeout(1000);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const want=+((h.store.format.fontSize||10)*25.4/72).toFixed(3);
      const dims=(P.dxf.dims||[]);
      const secs=(P.dxf.secs||[]).filter(s=>s.ok);
      let vals=0, wrongSize=0;
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(!t._dim) return; vals++; if(Math.abs(t.h-want)>0.01) wrongSize++; }));
      // section geometry, judged the same way as always
      const sec=secs.map(s=>{
        const g=h.secGeomOf(s), A=g.pts[1], B=g.pts[2];
        const L=Math.hypot(B[0]-A[0],B[1]-A[1])||1;
        const u=[(B[0]-A[0])/L,(B[1]-A[1])/L], n=[-u[1],u[0]];
        const v=s.ends[0].view;
        let onDim=0;
        (P.dxf.solids||[]).forEach(sd=>{ if(sd._sec===s.id && sd._dim) onDim++; });
        return {letter:s.letter, square:+Math.abs(u[0]*v[0]+u[1]*v[1]).toFixed(3),
          offLine:+Math.abs((s.ends[1].p[0]-A[0])*n[0]+(s.ends[1].p[1]-A[1])*n[1]).toFixed(3),
          fromDimensionArrows:onDim};
      });
      /* Count what is DRAWN, not how many models exist. A model whose fit was
         rejected is not drawn - the recovery pass then rebuilds that dimension
         from its strokes, so there are two models and one dimension. Counting
         models made a correct result look wrong. Two values printed on top of
         each other is what a real duplicate looks like, so that is measured. */
      const pts=[];
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(t._dim) pts.push([t.x+(o.dx||0), t.y+(o.dy||0), String(t.text)]); }));
      let dup=0;
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++)
        if(pts[i][2]===pts[j][2] && Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1])<1.5) dup++;
      return {models:dims.length, rejectedByTheFitCheck:dims.filter(m=>!m.ok).length,
              dimensionsDrawn:pts.length, duplicates:dup,
              secs:secs.length, valuesAtWrongSize:wrongSize, sec};
    });
    const good = r.dimensionsDrawn===WANT.dims && r.secs===WANT.secs
              && r.valuesAtWrongSize===0 && r.duplicates===0
              && r.sec.every(s=>s.offLine<0.01 && s.square<0.01 && s.fromDimensionArrows===0);
    console.log((f+'                ').slice(0,20),
      'drawn', String(r.dimensionsDrawn).padStart(3), '/', WANT.dims,
      '· markers', r.secs, '/', WANT.secs,
      '· wrong size', r.valuesAtWrongSize,
      '· duplicates', r.duplicates,
      '· fit rejected', String(r.rejectedByTheFitCheck).padStart(2),
      '·', good? 'OK' : 'DIFFERENT');
    if(!good) console.log('      ', JSON.stringify(r.sec));
    if(errs.length) console.log('       errors:', errs.slice(0,2));
    await b.close();
  }
})();
