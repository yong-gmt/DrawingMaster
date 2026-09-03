const {open,loadDxf}=require('./harness');
// Anything the marker itself drew that is still on the sheet after STYLIZE.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet3.dxf','Head-back.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.secs||[]).forEach(s=>{
      const g=h.secGeomOf(s);
      /* Near either elbow OF THIS MARKER. A second marker's cut line, or a
         breakout section 20 mm away, is somebody else's annotation - counting it
         made a clean marker look like it had leftovers. */
      const box=(q)=>{
        return Math.min(...[0,3].map(k=>Math.hypot(q[0]-g.pts[k][0], q[1]-g.pts[k][1])))<6; };
      let strokes=0, solids=0, drawn=0;
      (P.objects||[]).forEach(o=>{
        (o.prims.polys||[]).forEach(p=>{
          if(p.pts.length<2) return;
          const A=p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)]);
          if(p._sec===s.id){ drawn++; return; }
          // a section-layer stroke still sitting on the marker is a leftover
          if(p._section && A.some(box)) strokes++;
        });
        (o.prims.solids||[]).forEach(sd=>{
          let cx=0,cy=0; sd.forEach(q=>{cx+=q[0]+(o.dx||0);cy+=q[1]+(o.dy||0);});
          if(box([cx/sd.length, cy/sd.length])) solids++;
        });
      });
      out.push({id:s.id, drawnByModel:drawn, leftoverStrokes:strokes, leftoverSolids:solids});
    });
    return out;
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
