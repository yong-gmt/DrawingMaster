const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  // pick the most distinctive drawing font
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  await p.selectOption('#fFont','Consolas'); await p.waitForTimeout(400);
  await p.click('#fSave'); await p.waitForTimeout(900);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(700);
  console.log('drawing font    : '+await p.evaluate(()=>window.__hook().store.format.font));
  console.log('UI body font    : '+await p.evaluate(()=>getComputedStyle(document.body).fontFamily));

  // add a label and type Thai into it
  await p.click('#btnText'); await p.waitForTimeout(900);
  const box=await p.evaluate(()=>{ const el=document.querySelector('.inline-edit');
    if(!el) return null; const cs=getComputedStyle(el);
    return {tag:el.tagName, font:cs.fontFamily}; });
  console.log('label editor    : '+JSON.stringify(box));
  if(box){ await p.keyboard.type('ฝาครอบเฟือง'); await p.waitForTimeout(400);
    fs.writeFileSync(path.join(OUT,'ui_thai_edit.png'), await p.locator('#stage').screenshot());
    await p.keyboard.press('Enter'); await p.waitForTimeout(600); }
  fs.writeFileSync(path.join(OUT,'ui_thai_drawn.png'), await p.locator('#stage').screenshot());

  // the cover page zone editor
  const cv=await p.$('text=Cover'); if(cv) await cv.click(); await p.waitForTimeout(800);
  const zp=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='cover'); const z=(pg._zones||[])[0];
    if(!z) return null; const c=h.W2S(z.x+z.w/2, z.y+z.h/2);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+c.x, y:r.top+c.y, key:z.key}; });
  console.log('cover zone      : '+JSON.stringify(zp));
  if(zp){ await p.mouse.dblclick(zp.x, zp.y); await p.waitForTimeout(700); }
  console.log('zone editor     : '+JSON.stringify(await p.evaluate(()=>{
    const el=document.querySelector('.inline-edit'); if(!el) return 'none';
    return getComputedStyle(el).fontFamily; })));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
