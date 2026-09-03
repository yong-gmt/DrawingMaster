const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,file,sty] of [['import',require('./harness').APP,false],
                              ['old_sty',_p.join(require('./harness').ROOT,'src','base.html'),true],
                              ['new_sty',require('./harness').APP,true]]){
  for(const which of [0,1]){
    const {b,pg}=await open(file);
    await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
    // use a sane dimension text size so the marker itself is what we are looking at
    await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
    if(sty) await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    await pg.evaluate((w)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      // frame the top end of the vertical marker, or the left end of the horizontal one
      const box = w===0 ? [105,148,135,172] : [72,96,98,120];
      h.zoomRect(box[0],box[1],box[2],box[3]);
    }, which);
    await pg.waitForTimeout(350);
    fs.writeFileSync('sc_'+tag+'_'+which+'.png', await pg.locator('canvas').first().screenshot());
    await b.close();
  }
 }
 const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
 for(const t of ['import','old_sty','new_sty']) for(const w of [0,1])
   await sharp('sc_'+t+'_'+w+'.png').extract({left:330,top:120,width:760,height:540}).png().toFile('sc_'+t+'_'+w+'_c.png');
 console.log('done');
})();
