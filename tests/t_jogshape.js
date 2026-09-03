const {open,loadDxf}=require('./harness');
// A foreshortened radius carries a zig-zag saying "not to scale here". It has to
// read as a symbol: more than one cycle, and plainly smaller than the run it sits
// on. A single kink reads as a mistake; one as tall as the run reads as a detour.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1400);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.kind==='radial'&&m.ok).slice(0,3).forEach(m=>{
      const full=Math.hypot(m.centre[0]-m.point[0], m.centre[1]-m.point[1]);
      m.run={len: full*0.45};
      h.dimRelayout(P);
      const g=h.dimGeomOf(m), c=g.segs.find(s=>s.role==='cen');
      const pts=c.pts||[];
      // the run's own direction, and how far the zig-zag departs from it
      const A=pts[0], B=pts[pts.length-1];
      const L=Math.hypot(B[0]-A[0], B[1]-A[1])||1;
      const u=[(B[0]-A[0])/L,(B[1]-A[1])/L], n=[-u[1],u[0]];
      const offs=pts.map(q=>(q[0]-A[0])*n[0]+(q[1]-A[1])*n[1]);
      let crossings=0;
      for(let i=1;i<offs.length;i++)
        if((offs[i-1]>0.01 && offs[i]<-0.01)||(offs[i-1]<-0.01 && offs[i]>0.01)) crossings++;
      /* How much of the run the zig-zag occupies matters as much as how tall it
         is: the same two cycles spread thin across the whole run stop reading as
         one mark and start reading as a wandering line. */
      const alongs=pts.map(q=>(q[0]-A[0])*u[0]+(q[1]-A[1])*u[1]);
      const bent=alongs.filter((_,i)=>Math.abs(offs[i])>0.001);
      const span=bent.length? Math.max(...bent)-Math.min(...bent) : 0;
      out.push({runMM:+L.toFixed(1),
                zigzagHeightMM:+Math.max(...offs.map(Math.abs)).toFixed(2),
                crossings,
                heightAsShareOfTheRun:+(Math.max(...offs.map(Math.abs))/L).toFixed(3),
                spanMM:+span.toFixed(2),
                centredAt:+(((Math.max(...bent)+Math.min(...bent))/2)/L).toFixed(3),
                tallerThanItIsWidePerStep:+(Math.max(...offs.map(Math.abs))/(span/8||1)).toFixed(2)});
    });
    return out;
  });
  r.forEach(x=>console.log('run', String(x.runMM).padStart(5), 'mm ·',
    x.crossings, 'crossings ·', 'height', (x.heightAsShareOfTheRun*100).toFixed(1)+'%',
    'span', x.spanMM+' mm ·',
    'each step is', x.tallerThanItIsWidePerStep+'x taller than wide'));
  console.log('more than one cycle everywhere:', r.every(x=>x.crossings>=3));
  /* The mark is a SYMBOL: the same size on every dimension whatever the run does.
     Measuring it as a share of the run was the wrong question - a share that stays
     constant is a symbol that keeps changing size. */
  const heights=r.map(x=>x.zigzagHeightMM), spans=r.map(x=>x.spanMM);
  const same=(a)=>Math.max(...a)-Math.min(...a)<0.01;
  console.log('the same size on every dimension:', same(heights) && same(spans),
    '· height', heights[0].toFixed(2), 'mm · span', spans[0].toFixed(2), 'mm');
  console.log('always in the middle of the run:',
    r.every(x=>Math.abs(x.centredAt-0.5)<0.02));
  console.log('steep enough to read as one mark:',
    r.every(x=>x.tallerThanItIsWidePerStep>1.5));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
