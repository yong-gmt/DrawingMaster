const {chromium}=require('./_pw');
const path=require('path');
// When the store really IS full, the person has to be told - work that was not
// saved must never look saved.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(900);
  // fill the store with ballast first
  const filled=await p.evaluate(()=>{
    try{
      const chunk='x'.repeat(256*1024);
      for(let i=0;i<40;i++) localStorage.setItem('ballast'+i, chunk);
    }catch(e){}
    let n=0; for(const k in localStorage) if(k.indexOf('ballast')===0) n++;
    return n;
  });
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(2000);
  const said=await p.evaluate(()=>document.body.innerText);
  const saved=await p.evaluate(()=>{ try{
    return (localStorage['drawingmaster.projects.v1']||'').length; }catch(e){ return -1; } });
  console.log('ballast blocks written :', filled);
  console.log('project bytes saved    :', saved);
  console.log('the app says the store is full:', /เต็ม/.test(said));
  await b.close();
})();
