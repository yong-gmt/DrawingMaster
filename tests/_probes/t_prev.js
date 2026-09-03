const {open}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await pg.evaluate(()=>{ const h=window.__hook();
    const sh=h.store.pages.find(p=>p.type==='sheet'); if(sh) h.store.activeId=sh.id; h.render(); });
  await pg.evaluate(()=>{ const el=document.querySelector('#btnFormat')||
    [...document.querySelectorAll('*')].find(e=>/Format Config/.test(e.textContent||'')&&e.children.length===0);
    if(el) el.click(); });
  await pg.waitForTimeout(600);
  const info=await pg.evaluate(()=>{
    const c=document.querySelector('#strokePrev');
    return c? {found:true, w:c.clientWidth, h:c.clientHeight} : {found:false};
  });
  console.log(JSON.stringify(info));
  if(info.found){
    const el=await pg.$('#strokePrev');
    fs.writeFileSync('prev.png', await el.screenshot());
  }
  await b.close();
})();
