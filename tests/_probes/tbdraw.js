const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  // double-click the middle of the title block to open its panel
  const pt=await p.evaluate(()=>{ const h=window.__hook();
    const st=h.store, m=st.format.margin;
    const sizes={A4:[297,210],A3:[420,297],A2:[594,420],A1:[841,594],A0:[1189,841]};
    const [W,Hh]=sizes[st.format.paper]||sizes.A4;
    const c=h.W2S(W-m-170/2, m+24.68/2);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+c.x, y:r.top+c.y}; });
  await p.mouse.dblclick(pt.x, pt.y);
  await p.waitForTimeout(500);
  const i=await p.$('#tbDraw');
  if(!i){ console.log('PANEL NOT OPEN'); await b.close(); return; }
  const r=await p.evaluate(()=>{
    const inp=document.getElementById('tbDraw');
    const lab=inp.closest('.grp').querySelector('label');
    const ic=lab.querySelector('.lab-info');
    return {placeholder:inp.placeholder, label:lab.textContent.trim(),
            tip:ic?ic.getAttribute('title'):null, svg:ic&&ic.querySelector('svg')?1:0};
  });
  console.log('rightpanel '+JSON.stringify(r));
  await p.locator('.rp-body').screenshot({path:path.join(OUT,'ui_draw_rp.png')});
  await b.close();
})();
