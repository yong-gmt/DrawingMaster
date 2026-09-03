const {open,loadDxf}=require('./harness');
// After STYLIZE, is anything left over from the marker's ORIGINAL drawing?
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.secs||[]).forEach(s=>{
      const g=h.secGeomOf(s);
      const near=[];
      (P.objects||[]).forEach(o=>{
        (o.prims.polys||[]).forEach(p=>{
          if(p.pts.length<2 || p._sec===s.id) return;
          const A=p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)]);
          // within 10mm of either elbow?
          const d=Math.min(...A.flatMap(q=>[0,3].map(k=>
            Math.hypot(q[0]-g.pts[k][0], q[1]-g.pts[k][1]))));
          if(d<10) near.push({kind:'poly', layer:p._layer, sec:!!p._section, dim:p._dim||null,
            len:+Math.hypot(A[1][0]-A[0][0],A[1][1]-A[0][1]).toFixed(2),
            a:A[0].map(v=>+v.toFixed(2)), b:A[A.length-1].map(v=>+v.toFixed(2))});
        });
        (o.prims.solids||[]).forEach(sd=>{
          let cx=0,cy=0; sd.forEach(q=>{cx+=q[0]+(o.dx||0);cy+=q[1]+(o.dy||0);});
          cx/=sd.length; cy/=sd.length;
          const d=Math.min(...[0,3].map(k=>Math.hypot(cx-g.pts[k][0], cy-g.pts[k][1])));
          if(d<10) near.push({kind:'solid', sec:sd._sec||null, dim:sd._dim||null,
            c:[+cx.toFixed(2),+cy.toFixed(2)]});
        });
      });
      out.push({id:s.id, leftovers:near});
    });
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
