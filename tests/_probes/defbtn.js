const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.click('#btnDefaults'); await p.waitForTimeout(900);
  console.log('visible buttons on the Default Format page:');
  console.log(JSON.stringify(await p.evaluate(()=>
    [...document.querySelectorAll('button')].filter(el=>el.offsetParent!==null)
      .map(el=>({id:el.id||'(no id)', text:el.textContent.trim().slice(0,24)}))), null, 0));
  fs.writeFileSync(path.join(OUT,'ui_defaults_top.png'), await p.screenshot({clip:{x:0,y:0,width:1500,height:300}}));
  // and it must come back when the page is closed
  await p.click('#fCancel'); await p.waitForTimeout(700);
  console.log('back on the dashboard: '+JSON.stringify(await p.evaluate(()=>
    [...document.querySelectorAll('button')].filter(el=>el.offsetParent!==null)
      .map(el=>el.id||'(no id)'))));
  // the project's own Format Config must still have it (it is hidden behind the editor there)
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  await p.click('text=Format Config'); await p.waitForTimeout(900);
  console.log('project format config : createNew visible = '+await p.evaluate(()=>{
    const b=document.getElementById('btnCreate'); return !!(b && b.offsetParent!==null); }));
  await p.click('#fCancel'); await p.waitForTimeout(600);
  await p.click('#btnBack'); await p.waitForTimeout(800);
  console.log('dashboard again       : createNew visible = '+await p.evaluate(()=>{
    const b=document.getElementById('btnCreate'); return !!(b && b.offsetParent!==null); }));
  await b.close();
})();
