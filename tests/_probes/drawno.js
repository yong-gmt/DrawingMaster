const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  // Format Config
  await p.click('#btnDefaults'); await p.waitForTimeout(900);
  console.log('default format : '+JSON.stringify(await p.evaluate(()=>{
    const l=[...document.querySelectorAll('.f-field label')].find(x=>/Drawing No/.test(x.textContent));
    const i=l.parentElement.querySelector('input'), ic=l.querySelector('.lab-info');
    return {placeholder:i.placeholder, tip:ic&&ic.getAttribute('title')}; })));
  const fc=await p.$('.tb-sec'); if(fc) fs.writeFileSync(path.join(OUT,'ui_drawno_fc.png'), await fc.screenshot());
  await p.click('#fCancel'); await p.waitForTimeout(600);
  // the sheet's own panel, and what the title block draws
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  const pt=await p.evaluate(()=>{ const h=window.__hook(), st=h.store, m=st.format.margin;
    const P={A4:[297,210],A3:[420,297],A2:[594,420]}[st.format.paper];
    const c=h.W2S(P[0]-m-170/2, m+24.68/2);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+c.x, y:r.top+c.y}; });
  await p.mouse.dblclick(pt.x, pt.y); await p.waitForTimeout(700);
  console.log('title block panel: '+JSON.stringify(await p.evaluate(()=>{
    const i=document.getElementById('tbDraw');
    const ic=i.closest('.grp').querySelector('.lab-info');
    return {placeholder:i.placeholder, tip:ic&&ic.getAttribute('title'), painted:!!(ic&&ic.querySelector('svg'))}; })));
  const rp=await p.$('.rp-body'); if(rp) fs.writeFileSync(path.join(OUT,'ui_drawno_rp.png'), await rp.screenshot());
  const cl=await p.$('#rpClose'); if(cl) await cl.click(); await p.waitForTimeout(600);
  console.log('drawn on the sheet: '+JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    return h.captureSheet(pg).filter(e=>e.t==='text').map(e=>e.text).filter(t=>/PRJ|VER|REV/.test(t)); })));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
