const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// Their normal window is broken; a fresh incognito window is fine; no errors in
// the console. The only thing a normal window has that incognito does not is the
// data stored from hours of earlier use. So build a store the way theirs was
// built: project after project, each with a drawing imported into it.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  const files=['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf'];
  for(let i=0;i<10;i++){
    const back=await p.$('#btnBack');
    if(back && await back.isVisible()){ await back.click(); await p.waitForTimeout(500); }
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(400);
    await p.click('#btnImport');
    await p.setInputFiles('#fileInput', require('./harness').fixture(files[i%3]));
    await p.waitForTimeout(1600);
    const st=await p.evaluate(()=>{
      let size=0, ok=true;
      try{ size=(localStorage['drawingmaster.projects.v1']||'').length; }catch(e){ ok=false; }
      const h=window.__hook();
      return {projects:(h.DB||[]).length||null, size, ok};
    });
    if(i%3===0 || !st.ok) console.log('  project', i+1, '| stored bytes', st.size, st.ok?'':'(STORE UNREADABLE)');
  }
  console.log('now reload and open the first project, the way you would after a break');
  await p.reload(); await p.waitForTimeout(1500);
  fs.writeFileSync('many_dash.png', await p.screenshot());
  const cards=await p.$$('.card, [data-proj], .proj-card');
  const anyCard=await p.$('text=Project 1');
  if(anyCard){ await anyCard.click(); await p.waitForTimeout(1800);
    const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
    await p.waitForTimeout(1000); }
  const r=await p.evaluate(()=>{
    const h=window.__hook&&window.__hook();
    const P=h&&h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
    const cv=document.querySelector('canvas'); let ink=0;
    if(cv){ const c=cv.getContext('2d'); const d=c.getImageData(0,0,cv.width,cv.height).data;
      for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
    let stored=0; try{ stored=(localStorage['drawingmaster.projects.v1']||'').length; }catch(e){ stored='unreadable'; }
    return {projectsSaved:(h&&h.DB||[]).length, objects:P?(P.objects||[]).length:'no page',
            ink, storedBytes:stored};
  });
  console.log('after reopening:', JSON.stringify(r));
  console.log('javascript errors:', errs.length);
  errs.slice(0,4).forEach(e=>console.log('  '+e));
  fs.writeFileSync('many_sheet.png', await p.screenshot());
  await b.close();
})();
