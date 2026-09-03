const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE='/tmp/dm-defaults';
// The gear on the dashboard sets what a NEW project starts from. Projects that
// already exist keep what they were given - changing the starting point must not
// reach back into work already done - and the setting survives closing the app.
(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  let c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  let p=c.pages()[0]||await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1000);

  // an existing project, tuned by hand
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const h=window.__hook();
    h.store.format.fontSize=9; h.store.format.paper='A3'; h.store.format.stroke=0.15;
    h.store.name='Tuned by hand';
    /* persist() is what writes it down; afterMutate is not exposed to a test */
    h.persist && h.persist(); });
  await p.waitForTimeout(400);
  const back=await p.$('#btnBack'); if(back && await back.isVisible()) await back.click();
  await p.waitForTimeout(900);

  // now change the defaults
  await p.click('#btnDefaults'); await p.waitForTimeout(1000);
  /* the panel must say which of the two it is editing - a click handler passing
     the event object as the flag once made every Format Config button open the
     defaults, which nothing else would have shown */
  console.log('panel heading             :',
    JSON.stringify(await p.evaluate(()=>document.querySelector('.fmt-h1').textContent)));
  await p.evaluate(()=>{
    const set=(id,v)=>{ const e=document.querySelector(id); e.value=v;
      e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})); };
    set('#fSize', 18); set('#fPaper','A2'); set('#fStrokeRange', 0.6);
  });
  await p.waitForTimeout(400);
  await p.click('#fSave'); await p.waitForTimeout(800);

  const readNew=async()=>{
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
    const f=await p.evaluate(()=>{ const f=window.__hook().store.format;
      return {fontSize:f.fontSize, paper:f.paper, stroke:f.stroke, name:window.__hook().store.name}; });
    const bk=await p.$('#btnBack'); if(bk && await bk.isVisible()) await bk.click();
    await p.waitForTimeout(700);
    return f;
  };
  // and a project's own Format Config still edits that project
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh2=await p.$('text=Sheet 01'); if(sh2 && await sh2.isVisible()) await sh2.click();
  await p.waitForTimeout(500);
  await p.click('#btnFormat'); await p.waitForTimeout(800);
  console.log('a project opens instead    :',
    JSON.stringify(await p.evaluate(()=>document.querySelector('.fmt-h1').textContent)));
  await p.click('#fCancel'); await p.waitForTimeout(600);
  const bk0=await p.$('#btnBack'); if(bk0 && await bk0.isVisible()) await bk0.click();
  await p.waitForTimeout(700);

  const fresh=await readNew();
  console.log('a NEW project starts with :', JSON.stringify(fresh));

  const old=await p.evaluate(()=>{
    const h=window.__hook();
    /* the project list is asynchronous now, so read it the way the app does */
    const list=h.projects();
    const proj=list.find(x=>x.name==='Tuned by hand');
    return proj? {fontSize:proj.format.fontSize, paper:proj.format.paper, stroke:proj.format.stroke} : null;
  });
  console.log('the tuned project still has:', JSON.stringify(old));
  console.log('  new project took the defaults  :',
    fresh.fontSize===18 && fresh.paper==='A2' && Math.abs(fresh.stroke-0.6)<1e-9);
  console.log('  the tuned one was left alone   :',
    old && old.fontSize===9 && old.paper==='A3' && Math.abs(old.stroke-0.15)<1e-9);
  console.log('  the project name was not copied:', fresh.name!=='Tuned by hand');
  await c.close();

  // and it survives closing the program
  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0]||await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  const after=await p.evaluate(()=>{ const f=window.__hook().store.format;
    return {fontSize:f.fontSize, paper:f.paper, stroke:f.stroke}; });
  console.log('after reopening, a new project starts with:', JSON.stringify(after));
  console.log('errors:', errs.length, errs.slice(0,2));
  await c.close();
})();
