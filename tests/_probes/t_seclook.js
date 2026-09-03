const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,file] of [['old',_p.join(require('./harness').ROOT,'src','base.html')],['new',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let a=1e9,b2=1e9,c=-1e9,d=-1e9;
    (P.dxf.hatches||[]).forEach(ht=>ht.loops.forEach(L=>L.forEach(p=>{
      a=Math.min(a,p[0]);b2=Math.min(b2,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); })));
    h.zoomRect(a-3,b2-3,c+3,d+3);
  });
  await pg.waitForTimeout(400);
  fs.writeFileSync('sh_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
 for(const t of ['old','new']) await sharp('sh_'+t+'.png').extract({left:300,top:150,width:900,height:500}).png().toFile('sh_'+t+'_c.png');
})();
