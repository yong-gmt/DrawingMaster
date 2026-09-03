const {open,loadDxf}=require('./harness');
// Does the elbow of a radius leader ever fly off? It is placed by intersecting the
// radial ray with the value's own y level - which blows up when the radius runs
// nearly horizontal, because the ray then barely changes y at all.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.ok&&x.kind==='radial');
    const out=[];
    // swing the radius direction round the clock and watch the leader length
    const C=m.centre.slice(), R=m.radius;
    for(let deg=0; deg<360; deg+=15){
      const a=deg*Math.PI/180;
      m.point=[C[0]+Math.cos(a)*R, C[1]+Math.sin(a)*R];
      const g=h.dimGeomOf(m);
      const lead=Math.hypot(g.elbow[0]-m.point[0], g.elbow[1]-m.point[1]);
      out.push({deg, leaderMM:+lead.toFixed(1)});
    }
    return out;
  });
  const worst=Math.max(...r.map(x=>x.leaderMM));
  console.log(JSON.stringify(r));
  console.log('longest leader', worst.toFixed(1), 'mm   (a page is ~300mm)');
  await b.close();
})();
