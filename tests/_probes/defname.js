const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const look=()=>{ const h=window.__hook();
  const inp=document.getElementById('fProject');
  return { field:inp.value, locked:inp.disabled, storeName:h.store? h.store.name : null }; };
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);

  // A) straight from a cold dashboard
  await p.click('#btnDefaults'); await p.waitForTimeout(800);
  console.log('cold dashboard   : '+JSON.stringify(await p.evaluate(look)));
  await p.click('#fCancel'); await p.waitForTimeout(600);

  // B) the case that was wrong: open a project, rename it, go back, open defaults
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const h=window.__hook(); h.store.name='ACME GEARBOX'; h.persist(); });
  await p.waitForTimeout(400);
  await p.click('#btnBack'); await p.waitForTimeout(800);
  await p.click('#btnDefaults'); await p.waitForTimeout(900);
  console.log('after a project  : '+JSON.stringify(await p.evaluate(look)));
  const box=await p.$('.tb-sec'); if(box) fs.writeFileSync(path.join(OUT,'ui_defname.png'), await box.screenshot());
  await p.click('#fCancel'); await p.waitForTimeout(700);

  // C) the real project must be untouched by any of that
  const card=await p.$('.proj-card, .pc'); if(card) await card.click();
  await p.waitForTimeout(1000);
  console.log('project intact   : '+JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    return {name:h.store.name, projects:h.projects().map(x=>x.name)}; })));

  // D) and the project's own Format Config still shows its own name
  await p.click('text=Format Config'); await p.waitForTimeout(900);
  console.log('project format   : '+JSON.stringify(await p.evaluate(look)));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
