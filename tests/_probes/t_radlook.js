const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  for(const [tag,off] of [['home',null],['out',26]]){
    await pg.evaluate((o)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=(P.dxf.dims||[]).filter(x=>x.kind==='radial').sort((a,b)=>b.radius-a.radius)[0];
      m.land.off=o; h.dimRelayout(P);
      const g=h.dimGeomOf(m);
      const xs=[g.text.x-15,g.landEnd[0],m.point[0],g.centreAt[0]];
      const ys=[g.text.y,m.point[1],g.centreAt[1]];
      h.zoomRect(Math.min(...xs)-6,Math.min(...ys)-6,Math.max(...xs)+6,Math.max(...ys)+6);
      h.render();
    }, off);
    await pg.waitForTimeout(300);
    fs.writeFileSync('slide_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();
