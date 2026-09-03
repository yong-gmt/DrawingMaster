const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,sty] of [['import',false],['stylize',true]]){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  if(sty) await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.evaluate(()=>{ const h=window.__hook(); h.zoomRect(78,88,105,124); });
  await pg.waitForTimeout(350);
  fs.writeFileSync('hub_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
 for(const t of ['import','stylize']) await sharp('hub_'+t+'.png').extract({left:400,top:60,width:640,height:660}).png().toFile('hub_'+t+'_c.png');
})();
