const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.kind==='radial').forEach(m=>{
      const g=h.dimGeomOf(m);
      out.push({id:m.id, r:+m.radius.toFixed(2), far:g.foreshortened,
        cen:g.centreAt.map(v=>+v.toFixed(1)),
        realCen:m.centre.map(v=>+v.toFixed(1)),
        roles:g.segs.map(s=>s.role)});
    });
    return out;
  });
  console.log(JSON.stringify(info,null,0));
  // zoom to show one radius plus its centre mark
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).filter(x=>x.kind==='radial').sort((a,b)=>b.radius-a.radius)[0];
    const g=h.dimGeomOf(m);
    const xs=[g.text.x, g.centreAt[0], m.point[0]], ys=[g.text.y, g.centreAt[1], m.point[1]];
    h.zoomRect(Math.min(...xs)-10, Math.min(...ys)-10, Math.max(...xs)+10, Math.max(...ys)+10);
  });
  await pg.waitForTimeout(350);
  fs.writeFileSync('cen.png', await pg.locator('canvas').first().screenshot());
  await b.close();
})();
