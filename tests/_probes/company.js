const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);

  // 1. a brand new project
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  console.log('new project      : '+JSON.stringify(await p.evaluate(()=>window.__hook().store.format.company)));

  // 2. a project saved by the older build, with the typo baked in - and one where
  //    somebody has typed their own name, which must not be touched
  const id=await p.evaluate(()=>window.__hook().store.id);
  await p.evaluate(()=>{ const h=window.__hook();
    h.store.format.company='General Magick (Thailand) Co., LTD'; h.persist(); });
  await p.click('#btnBack'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(1400);
  const card=await p.$('.proj-card, .pc'); if(card) await card.click();
  await p.waitForTimeout(1200);
  console.log('reopened project : '+JSON.stringify(await p.evaluate(()=>window.__hook().store.format.company)));
  console.log('  and it stuck   : '+JSON.stringify(await p.evaluate(()=>{
    const DB=JSON.parse(localStorage.getItem('drawingmaster.projects.v1')||'[]');
    return DB.map(x=>x.format && x.format.company); })));

  await p.evaluate(()=>{ const h=window.__hook();
    h.store.format.company='Acme Magick Works Ltd'; h.persist(); });
  await p.click('#btnBack'); await p.waitForTimeout(700);
  const card2=await p.$('.proj-card, .pc'); if(card2) await card2.click();
  await p.waitForTimeout(1000);
  console.log('somebody else’s name: '+JSON.stringify(await p.evaluate(()=>window.__hook().store.format.company)));

  // 3. what the cover page actually draws
  await p.evaluate(()=>{ const h=window.__hook();
    h.store.format.company='General Magick (Thailand) Co., LTD'; h.persist(); });
  await p.click('#btnBack'); await p.waitForTimeout(700);
  const card3=await p.$('.proj-card, .pc'); if(card3) await card3.click();
  await p.waitForTimeout(1000);
  const cv=await p.$('text=Cover'); if(cv) await cv.click(); await p.waitForTimeout(900);
  console.log('drawn on the cover: '+JSON.stringify(await p.evaluate(()=>{
    const h=window.__hook(); const pg=h.store.pages.find(x=>x.type==='cover');
    return (pg._zones||[]).filter(z=>z.key==='company').map(z=>z.val); })));
  fs.writeFileSync(path.join(OUT,'ui_company.png'), await p.locator('#stage').screenshot());
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
