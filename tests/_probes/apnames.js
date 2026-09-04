const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const names=()=>{ const h=window.__hook(); const a=h.store.format.approvals||{};
  return ['design','drawn','approved'].map(k=>(a[k]||{}).name||'-').join(' / '); };
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);

  // 1. a project made BEFORE the defaults are saved
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const oldId=await p.evaluate(()=>window.__hook().store.id);
  console.log('OLD project approvals : '+await p.evaluate(names));
  await p.click('#btnBack'); await p.waitForTimeout(700);

  // 2. type the names into Default Format and save
  await p.click('#btnDefaults'); await p.waitForTimeout(800);
  const row=async(k,v)=>{ await p.fill(`[data-ap="${k}"][data-fld="name"]`, v); };
  await row('design','SOMCHAI'); await row('drawn','MALEE'); await row('approved','WIRAT');
  await p.waitForTimeout(200);
  await p.click('#fSave'); await p.waitForTimeout(900);
  console.log('stored defaults       : '+await p.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('drawingmaster.defaultFormat.v1')||'{}');
    const a=d.approvals||{};
    return ['design','drawn','approved'].map(k=>((a[k]||{}).name||'-')+'|date="'+((a[k]||{}).date||'')+'"').join('  '); }));

  // 3. reload, then make a NEW project
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(900);
  console.log('NEW project approvals : '+await p.evaluate(names));
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(700);
  fs.writeFileSync(path.join(OUT,'ui_apnames.png'), await p.locator('#stage').screenshot());

  // 4. the project made earlier must be untouched
  await p.click('#btnBack'); await p.waitForTimeout(700);
  await p.evaluate(id=>window.__hook().openProject?window.__hook().openProject(id):null, oldId);
  const back=await p.evaluate(id=>{ const h=window.__hook();
    const pr=(JSON.parse(localStorage.getItem('drawingmaster.projects.v1')||'[]')).find(x=>x.id===id);
    const a=(pr&&pr.format&&pr.format.approvals)||{};
    return ['design','drawn','approved'].map(k=>(a[k]||{}).name||'-').join(' / '); }, oldId);
  console.log('OLD project after     : '+back);
  await b.close();
})();
