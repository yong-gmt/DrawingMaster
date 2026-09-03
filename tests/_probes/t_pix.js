const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  for(const [tag,file] of [['a',_p.join(require('./harness').ROOT,'src','base.html')],['b',require('./harness').APP]]){
    const {b,pg}=await open(file);
    await loadDxf(pg,dxf);
    await pg.waitForTimeout(400);
    const shot=await pg.locator('canvas').first().screenshot();
    fs.writeFileSync(`shot_${dxf.slice(-9,-4)}_${tag}.png`, shot);
    await b.close();
  }
 }
 console.log('done');
})();
