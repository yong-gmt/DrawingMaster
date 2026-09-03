const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,file] of [['a',_p.join(require('./harness').ROOT,'src','base.html')],['b',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // zoom onto the biggest radius annotation, model or not
    let box=null;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!/^R\s*2[0-9]/.test(String(t.text))) return;
      const x=t.x+(o.dx||0), y=t.y+(o.dy||0);
      box={x0:x-45,y0:y-30,x1:x+25,y1:y+30};
    }));
    if(box) h.zoomRect(box.x0,box.y0,box.x1,box.y1);
  });
  await pg.waitForTimeout(350);
  fs.writeFileSync('rad_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
 console.log('done');
})();
