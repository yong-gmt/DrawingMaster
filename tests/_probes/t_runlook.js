const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  for(const [tag,frac] of [['full',null],['short',0.45]]){
    await pg.evaluate((frac)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=(P.dxf.dims||[]).filter(x=>x.ok&&x.kind==='radial').sort((a,b)=>b.radius-a.radius)[0];
      m.run.len = frac? m.radius*frac : null;
      h.dimApply(P,m); h.render();
      const g=h.dimGeomOf(m);
      const xs=[g.text.x, g.centreAt[0], m.point[0]], ys=[g.text.y, g.centreAt[1], m.point[1]];
      h.zoomRect(Math.min(...xs)-6, Math.min(...ys)-6, Math.max(...xs)+6, Math.max(...ys)+6);
    }, frac);
    await pg.waitForTimeout(350);
    fs.writeFileSync('run_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();
