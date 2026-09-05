const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const DXF=process.argv[2]||'decimals.dxf', WANT=process.argv[3]||'2';
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2200);
  console.log('decimals before   : '+await p.evaluate(()=>window.__hook().store.format.decimals));
  // the human path: Format Config -> Decimals -> Save
  await p.click('text=Format Config'); await p.waitForTimeout(900);
  console.log('select shows      : '+await p.evaluate(()=>document.getElementById('fDec').value));
  await p.selectOption('#fDec', WANT); await p.waitForTimeout(300);
  await p.click('#fSave'); await p.waitForTimeout(1100);
  console.log('decimals after    : '+await p.evaluate(()=>window.__hook().store.format.decimals)
    +'  (typeof '+await p.evaluate(()=>typeof window.__hook().store.format.decimals)+')');
  const before=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId); const o=[];
    (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>o.push(String(t.text))));
    return o.sort(); });
  console.log('before STYLIZE    : '+JSON.stringify(before));
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  const after=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId); const o=[];
    (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>o.push(String(t.text))));
    return o.sort(); });
  console.log('after  STYLIZE    : '+JSON.stringify(after));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
