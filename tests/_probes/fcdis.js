const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const SCAN=()=>{
  const open=[], locked=[];
  document.querySelectorAll('#formatView .tb-sec input').forEach(i=>{
    const fld=i.closest('.f-field'), row=i.closest('.appr-row');
    let name = fld ? fld.querySelector('label').textContent.trim() : '?';
    if(fld && fld.querySelectorAll('input').length>1) name+=' '+(i.id||'');
    if(row) name = row.querySelector('.rl').textContent+' '+(i.dataset.fld==='name'?'name':'date-'+i.dataset.fld);
    (i.disabled?locked:open).push(name);
  });
  return {h1:document.querySelector('.fmt-h1').textContent.trim(), editable:open, locked};
};
const show=(tag,r)=>{ console.log(tag+' h1="'+r.h1+'"');
  console.log('  editable: '+(r.editable.join(', ')||'(none)'));
  console.log('  locked  : '+(r.locked.join(', ')||'(none)')); };
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  // A) the dashboard gear -> Default Format
  await p.click('#btnDefaults'); await p.waitForTimeout(800);
  show('DEFAULTS ', await p.evaluate(SCAN));
  let box=await p.$('.tb-sec'); if(box) fs.writeFileSync(path.join(OUT,'ui_fc_default.png'), await box.screenshot());
  await p.click('#fCancel'); await p.waitForTimeout(500);
  // B) inside a project -> Format Config
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  show('PROJECT  ', await p.evaluate(SCAN));
  box=await p.$('.tb-sec'); if(box) fs.writeFileSync(path.join(OUT,'ui_fc_project.png'), await box.screenshot());
  await b.close();
})();
