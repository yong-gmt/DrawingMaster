const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// The BOM: text two points smaller than the sheet except its heading, and a thing
// on the page you can select and delete.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(800);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(1500);
  await p.click('#btnBom'); await p.waitForTimeout(700);
  const rp=await p.$('#rpSave'); if(rp) await rp.click();
  await p.waitForTimeout(400);

  for(const pt of [10, 16]){
    const r=await p.evaluate((pt)=>{
      const h=window.__hook(); h.store.format.fontSize=pt; h.render();
      return {sheetMM:+(pt*25.4/72).toFixed(4),
              tableMM:+h.bomFontMM().toFixed(4), headingMM:+h.bomTitleMM().toFixed(4)};
    }, pt);
    console.log('sheet at '+pt+' pt: heading', r.headingMM, 'mm (= sheet:', r.headingMM===r.sheetMM,
      ') | table', r.tableMM, 'mm (= sheet - 2pt:',
      Math.abs(r.tableMM-((pt-2)*25.4/72))<1e-3, ')');
  }

  // back to the default before the picture, so it shows the normal look
  await p.evaluate(()=>{ window.__hook().store.format.fontSize=10; window.__hook().render(); });
  await p.waitForTimeout(300);
  // does the heading still fit its columns at the sheet size?
  const fit=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const c=document.createElement('canvas').getContext('2d');
    c.font='700 '+h.bomFontMM()+'px '+h.store.format.font+',Arial';
    const bb=h.bomBounds(P);
    let worst=0;
    ['PART NO.','TITLE','QUANTITY','MATERIAL','FINISH','PRODUCTION'].forEach((s,i)=>{
      const w=c.measureText(s).width, col=bb.ws[i];
      if(col) worst=Math.max(worst, w-(col-1));
    });
    return +worst.toFixed(2);
  });
  console.log('widest heading overflows its column by:', fit, 'mm', fit<=0?'(fits)':'(TOO WIDE)');

  // click inside the table: does it select?
  const sel=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.bomBounds(P);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    // the middle of the table is a column divider, which is a resize handle -
    // click inside a cell instead, the way a person grabs the table to move it
    const A=h.W2S(bb.x+bb.w*0.18, bb.y-bb.h*0.72);
    return {x:rc.left+A.x, y:rc.top+A.y};
  });
  await p.mouse.move(sel.x, sel.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(300);
  const state=await p.evaluate(()=>{
    const h=window.__hook(); return {selected:[...h.selIds], hasBom:!!h.store.pages
      .find(x=>x.id===h.store.activeId).bom}; });
  console.log('clicking the table selects it:', state.selected.includes('bom'), state.selected);
  fs.writeFileSync('bom.png', await p.locator('canvas').first().screenshot());

  await p.keyboard.press('Delete'); await p.waitForTimeout(500);
  const after=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {hasBom:!!P.bom, selected:[...h.selIds].length}; });
  console.log('Delete removes it:', !after.hasBom);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
