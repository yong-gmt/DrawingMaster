const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,file] of [['old',_p.join(require('./harness').ROOT,'src','base.html')],['new',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'hatch_test.dxf');
  await pg.evaluate(()=>{ const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.entitiesBBox(P); h.zoomRect(bb.minx-3,bb.miny-3,bb.maxx+3,bb.maxy+3); });
  await pg.waitForTimeout(400);
  fs.writeFileSync('hp_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 console.log('done');
})();
