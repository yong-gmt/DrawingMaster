const {open}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await pg.evaluate(()=>document.querySelector('#btnFormat').click());
  await pg.waitForTimeout(700);
  for(const [tag,stroke,size] of [['default',0.2,10],['thin',0.15,8],['thick',0.7,18]]){
    await pg.evaluate(({stroke,size})=>{
      const r=document.querySelector('#fStrokeRange'); r.value=stroke;
      r.dispatchEvent(new Event('input',{bubbles:true}));
      const s=document.querySelector('#fSize'); s.value=size;
      s.dispatchEvent(new Event('input',{bubbles:true}));
    }, {stroke,size});
    await pg.waitForTimeout(250);
    for(const sel of ['#typoPrev','#strokePrev']){
      const el=await pg.$(sel);
      fs.writeFileSync('pv_'+tag+'_'+sel.slice(1)+'.png', await el.screenshot());
    }
  }
  console.log('done');
  await b.close();
})();
