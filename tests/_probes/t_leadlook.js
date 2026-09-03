const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  for(const [tag,len] of [['as_is',null],['pulled_out',55]]){
    await pg.evaluate((len)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=(P.dxf.dims||[]).find(x=>x.ok && /5\.00/.test(String(x.text.override||'')));
      m.land.len=len; h.dimApply(P,m); h.render();
      const g=h.dimGeomOf(m);
      const xs=[g.text.x, g.centreAt[0], m.point[0], g.landEnd[0]];
      const ys=[g.text.y, g.centreAt[1], m.point[1], g.landEnd[1]];
      h.zoomRect(Math.min(...xs)-6, Math.min(...ys)-6, Math.max(...xs)+6, Math.max(...ys)+6);
    }, len);
    await pg.waitForTimeout(350);
    fs.writeFileSync('lead_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();
