const {open}=require('./harness');
const fs=require('fs');
// The preview has to move when the settings move.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await pg.evaluate(()=>{ const h=window.__hook();
    const sh=h.store.pages.find(p=>p.type==='sheet'); if(sh) h.store.activeId=sh.id; h.render(); });
  await pg.evaluate(()=>document.querySelector('#btnFormat').click());
  await pg.waitForTimeout(800);
  console.log('controls present:', await pg.evaluate(()=>
    ['#fStrokeRange','#fSize','#strokePrev','#typoPrev'].map(s=>s+'='+!!document.querySelector(s)).join(' ')));
  for(const [tag,stroke,size] of [['thin',0.15,8],['thick',0.7,18]]){
    await pg.evaluate(({stroke,size})=>{
      const r=document.querySelector('#fStrokeRange'); r.value=stroke;
      r.dispatchEvent(new Event('input',{bubbles:true}));
      const s=document.querySelector('#fSize'); s.value=size;
      s.dispatchEvent(new Event('input',{bubbles:true}));
    }, {stroke,size});
    await pg.waitForTimeout(200);
    const el=await pg.$('#strokePrev');
    fs.writeFileSync('prev_'+tag+'.png', await el.screenshot());
  }
  const t=await pg.evaluate(()=>document.querySelector('#typoPrev').textContent);
  console.log('typography preview says:', JSON.stringify(t));
  await b.close();
})();
