const {open,loadDxf}=require('./harness');
const fs=require('fs');
// The exported file must also LOOK like what was on screen.
(async()=>{
 for(const src of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  for(const [tag,file] of [['a',src],['b','rt_'+src]]){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,file);
    if(tag==='a') await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    await pg.evaluate(()=>{ const h=window.__hook();
      const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
    await pg.waitForTimeout(400);
    fs.writeFileSync('rt_'+src.slice(0,4)+'_'+tag+'.png', await pg.locator('canvas').first().screenshot());
    await b.close();
  }
 }
 console.log('shots done');
})();
