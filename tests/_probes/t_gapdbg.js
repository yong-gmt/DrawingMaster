const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const c=document.createElement('canvas').getContext('2d'); const PXMM=96/25.4;
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const g=h.dimGeomOf(m), u=m.dir, n=[-u[1],u[0]], D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      c.font=(m.text.h*10)+'px '+h.store.format.font+',Arial';
      const mt=c.measureText(String(g.text.str));
      const w=mt.width/10, asc=mt.actualBoundingBoxAscent/10, desc=mt.actualBoundingBoxDescent/10;
      const rr=(g.text.rot||0)*Math.PI/180;
      const right=[Math.cos(rr),Math.sin(rr)], up=[-Math.sin(rr),Math.cos(rr)];
      const A=[g.text.x,g.text.y];
      const qs=[[-w/2,-desc],[w/2,-desc],[-w/2,asc],[w/2,asc]]
        .map(([a,b2])=>D([A[0]+right[0]*a+up[0]*b2, A[1]+right[1]*a+up[1]*b2],n));
      const gap=Math.min(...qs.map(v=>Math.abs(v-m.line.q)))*PXMM;
      if(gap<3.99) out.push({id:m.id, str:g.text.str, gap:+gap.toFixed(3),
        grows:g.text.grows, desc:+desc.toFixed(3), asc:+asc.toFixed(3), h:m.text.h});
    });
    return out;
  });
  console.log(JSON.stringify(r.slice(0,6)));
  await b.close();
})();
