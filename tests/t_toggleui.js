const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// Click the one switch the way a person does, and check both what it says and
// what STYLIZE then does. The two old per-kind switches are gone: they asked
// which rules applied to which annotation, which is not a question worth asking.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);

  const panel=async()=>{ await p.click('#btnFormat'); await p.waitForTimeout(700); };
  const save=async()=>{ await p.click('#fSave'); await p.waitForTimeout(600); };
  const shot=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+((h.store.format.fontSize||10)*25.4/72).toFixed(3);
    const S=[]; let wrong=0, vals=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>S.push(JSON.stringify(q.pts)));
      (o.prims.texts||[]).forEach(t=>{ if(!t._dim) return;
        vals++; if(Math.abs(t.h-want)>0.01) wrong++; }); });
    return {ink:S.sort().join(';'), values:vals, atWrongSize:wrong};
  });

  await panel();
  console.log('switches on the panel:', await p.evaluate(()=>document.querySelectorAll('.switch').length));
  console.log('fonts offered        :', await p.evaluate(()=>
    [...document.querySelectorAll('#fFont option')].map(o=>o.value).join(', ')));
  // turn it OFF and raise the text size
  const wasOn=await p.$eval('#fAnsiR', el=>el.classList.contains('on'));
  if(wasOn) await p.click('#fAnsiR');
  await p.evaluate(()=>{ const s=document.querySelector('#fSize'); s.value=16;
    s.dispatchEvent(new Event('input',{bubbles:true})); });
  await save();
  const before=await shot();
  await p.click('#btnStylize'); await p.waitForTimeout(1000);
  const off=await shot();
  console.log('OFF -> text sized:', off.atWrongSize===0,
              '| drawing left alone:', off.ink===before.ink);

  await panel(); await p.click('#fAnsiR'); await save();
  await p.click('#btnStylize'); await p.waitForTimeout(1000);
  const on=await shot();
  console.log('ON  -> text sized:', on.atWrongSize===0,
              '| drawing restyled  :', on.ink!==off.ink);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
