const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.ok&&/12\.00/.test(String(x.text.override||'')));
    const C=m.centre;
    h.zoomRect(C[0]-22, C[1]-26, C[0]+26, C[1]+16);
    // list every arrowhead in that window, with who owns it and where it points
    const out=[];
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(!p._arrow) return;
      const A=p.pts.map(q=>[q[0]+(o.dx||0), q[1]+(o.dy||0)]);
      const add=(tip,from)=>{
        if(Math.abs(tip[0]-C[0])>26||Math.abs(tip[1]-C[1])>26) return;
        const d=(P.dxf.dims||[]).find(x=>x.id===p._dim);
        out.push({dim:p._dim, role:p._role,
          val:d? String(d.text.override||d.text.value):null,
          at:[+tip[0].toFixed(1),+tip[1].toFixed(1)],
          dirDeg:+(Math.atan2(tip[1]-from[1],tip[0]-from[0])*180/Math.PI).toFixed(0)});
      };
      if(p._arrow.s) add(A[0],A[1]);
      if(p._arrow.e) add(A[A.length-1],A[A.length-2]);
    }));
    return {centre:C.map(v=>+v.toFixed(1)), heads:out};
  });
  console.log(JSON.stringify(info,null,0));
  await pg.waitForTimeout(400);
  fs.writeFileSync('hub.png', await pg.locator('canvas').first().screenshot());
  await b.close();
})();
