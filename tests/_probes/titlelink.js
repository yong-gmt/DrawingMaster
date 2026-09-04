const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);

  // 1. type Title + Version into Format Config and save
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  await p.fill('#fTitle','MASTER PLATE'); await p.fill('#fVersion','A');
  await p.waitForTimeout(300); await p.click('#fSave'); await p.waitForTimeout(1000);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(800);
  const drawn=()=>p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    const ts=h.captureSheet(pg).filter(e=>e.t==='text').map(e=>e.text);
    return ts.filter(t=>/PLATE|^A$|^VER/.test(t)); });
  console.log('1 drawn on sheet    : '+JSON.stringify(await drawn()));

  // 2. the sheet's own panel opens showing them
  const openPanel=async()=>{ const pt=await p.evaluate(()=>{ const h=window.__hook(), st=h.store, m=st.format.margin;
      const P={A4:[297,210],A3:[420,297],A2:[594,420]}[st.format.paper];
      const c=h.W2S(P[0]-m-170/2, m+24.68/2);
      const r=document.getElementById('stage').getBoundingClientRect();
      return {x:r.left+c.x, y:r.top+c.y}; });
    await p.mouse.dblclick(pt.x, pt.y); await p.waitForTimeout(600); };
  await openPanel();
  console.log('2 panel shows       : '+JSON.stringify(await p.evaluate(()=>({
    title:document.getElementById('tbTitle').value,
    version:document.getElementById('tbVer').value }))));

  // 3. change the sheet's title here; Format Config must keep its own
  await p.fill('#tbTitle','COVER PLATE'); await p.waitForTimeout(300);
  const save=await p.$('#rpSave'); if(save){ await save.click(); await p.waitForTimeout(800); }
  console.log('3 drawn on sheet    : '+JSON.stringify(await drawn()));
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  console.log('3 format config     : '+JSON.stringify(await p.evaluate(()=>({
    title:document.getElementById('fTitle').value,
    version:document.getElementById('fVersion').value }))));
  await p.click('#fCancel'); await p.waitForTimeout(700);

  // 4. a second sheet with a different title -> the Format Config box goes blank
  await p.evaluate(()=>{ const h=window.__hook();
    const s2=JSON.parse(JSON.stringify(h.store.pages.find(x=>x.type==='sheet')));
    s2.id='sheet2'; s2.name='Sheet 02'; s2.title={...s2.title, title:'BASE PLATE'};
    h.store.pages.push(s2); h.persist(); });
  await p.waitForTimeout(400);
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  console.log('4 titles differ     : '+JSON.stringify(await p.evaluate(()=>({
    title:document.getElementById('fTitle').value,
    version:document.getElementById('fVersion').value }))));

  // 5. the chosen font really reaches the title block
  for(const fnt of ['Arial','Sarabun','Consolas']){
    await p.selectOption('#fFont',fnt); await p.waitForTimeout(700);
    const w=await p.evaluate(async f=>{ try{ await document.fonts.load('700 40px "'+f+'"'); }catch(e){}
      const c=document.createElement('canvas').getContext('2d');
      c.font=`700 40px ${f},Arial`; return +c.measureText('MASTER PLATE').width.toFixed(1); }, fnt);
    console.log('5 font '+fnt.padEnd(9)+' -> "MASTER PLATE" measures '+w+' px');
  }
  const box=await p.$('.tbprevbox'); if(box) fs.writeFileSync(path.join(OUT,'ui_font_prev.png'), await box.screenshot());
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
