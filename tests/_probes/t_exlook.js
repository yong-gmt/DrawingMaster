const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,app] of [['before',_p.join(require('./harness').ROOT,'src','base.html')],['after',require('./harness').APP]]){
  const {b,pg}=await open(app);
  await loadDxf(pg,'exploded_Head-back.dxf');
  if(tag==='after') await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.evaluate(()=>{ const h=window.__hook();
    const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
  await pg.waitForTimeout(500);
  fs.writeFileSync('ex_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
 for(const t of ['before','after'])
   await sharp('ex_'+t+'.png').extract({left:230,top:20,width:1160,height:740}).png().toFile('ex_'+t+'_c.png');
})();
