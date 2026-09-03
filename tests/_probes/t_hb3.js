const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,sty] of [['import',false],['stylize',true]]){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  if(sty) await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(400);
  fs.writeFileSync('hb_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 console.log('done');
})();
