const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'exploded_Head-back.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // how many candidate values and arrowheads are even present?
    const vals=[], arrows=[];
    (P.dxf.texts||[]).forEach(t=>{ const s=String(t.text||'').trim();
      if(/\d/.test(s) && s.length<16) vals.push(s); });
    (P.dxf.solids||[]).forEach(sd=>arrows.push(sd.length));
    let tri=0;
    (P.dxf.polys||[]).forEach(p=>{ const n=p.pts.length;
      if(n>=3&&n<=5 && Math.hypot(p.pts[0][0]-p.pts[n-1][0],p.pts[0][1]-p.pts[n-1][1])<0.05) tri++; });
    return {valueTexts:vals.length, sampleValues:vals.slice(0,8),
            solids:arrows.length, closedTriangles:tri,
            models:(P.dxf.dims||[]).length};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
