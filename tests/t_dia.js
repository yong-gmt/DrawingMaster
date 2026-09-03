const {open,loadDxf}=require('./harness');
// A diameter must be drawn on ONE side only - the side the value is on. Nothing
// should be drawn on the far side of the centre.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      const C=m.centre, Pp=m.point;
      const ux=(Pp[0]-C[0])/m.radius, uy=(Pp[1]-C[1])/m.radius;   // towards the value
      let beyond=0, arrows=0;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id || p.pts.length<2) return;
        const A=p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)]);
        // Only the dimension line itself has a near and a far side. The value's
        // landing is horizontal and may reach across - that is where the text has
        // to sit, and it is not "the far side of the dimension".
        if(p._role==='cen') A.forEach(q=>{
          if((q[0]-C[0])*ux+(q[1]-C[1])*uy < -0.6) beyond++; });
        if(p._arrow) arrows+=(p._arrow.s?1:0)+(p._arrow.e?1:0);
      }));
      out.push({id:m.id, kind:m.kind, arrows, pointsPastTheCentre:beyond});
    });
    return out;
  });
  console.log(dxf, JSON.stringify({dims:r.length,
    drawnOnTheFarSide:r.filter(x=>x.pointsPastTheCentre>0).length,
    moreThanOneArrow:r.filter(x=>x.arrows!==1).length}));
  await b.close();
 }
})();
