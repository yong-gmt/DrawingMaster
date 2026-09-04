const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  for(const sz of ['A4','A3','A2','A4']){
    await p.selectOption('#fPaper', sz); await p.waitForTimeout(250);
    const r=await p.evaluate(()=>{ const m=document.getElementById('fMargin');
      return {paper:document.getElementById('fPaper').value, shown:m.value, locked:m.disabled}; });
    console.log(`${r.paper} -> ${r.shown} mm  locked=${r.locked}`);
  }
  const box=await p.$('.fmt-sec'); if(box) fs.writeFileSync(path.join(OUT,'ui_margin.png'), await box.screenshot());
  // save on A4 and measure the frame the sheet actually draws
  await p.click('#fSave'); await p.waitForTimeout(1000);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(800);
  const fr=await p.evaluate(()=>{ const h=window.__hook(), f=h.store.format;
    const P={A4:[297,210],A3:[420,297],A2:[594,420]}[f.paper];
    return {paper:f.paper, margin:f.margin,
            frame:[f.margin, f.margin, P[0]-f.margin, P[1]-f.margin],
            tbX:P[0]-f.margin-170, tbY:f.margin}; });
  console.log('sheet: '+JSON.stringify(fr));
  fs.writeFileSync(path.join(OUT,'ui_margin_sheet.png'), await p.locator('#stage').screenshot());
  await b.close();
})();
