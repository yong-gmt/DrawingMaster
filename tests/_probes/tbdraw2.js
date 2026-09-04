const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  await p.click('text=Format Config'); await p.waitForTimeout(700);
  const r=await p.evaluate(()=>{
    const labs=[...document.querySelectorAll('.f-field label')].filter(l=>/Drawing No/.test(l.textContent));
    return labs.map(l=>{ const ic=l.querySelector('.lab-info');
      return {label:l.textContent.trim(), tip:ic?ic.getAttribute('title'):null,
              svg:ic&&ic.querySelector('svg')?1:0,
              placeholder:l.parentElement.querySelector('input').placeholder}; });
  });
  console.log('formatconfig '+JSON.stringify(r));
  const box=await p.$('.tb-sec');
  if(box) fs.writeFileSync(path.join(OUT,'ui_draw_fc.png'), await box.screenshot());
  await b.close();
})();
