const _p=require('path');
const {chromium}=require('./_pw');
const path=require('path');
// Every test so far started with an EMPTY browser. A person does not. They open
// the app in the browser they already used, and the app restores what was there.
// This opens the OLD build, does some work, then loads the NEW build in the SAME
// browser profile - exactly what happens when you download an updated file.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  const load=async(file)=>{
    await page.goto('file://'+require('./harness').fixture(file));
    await page.waitForTimeout(900);
  };
  const state=async(tag)=>{
    const r=await page.evaluate(()=>{
      const h=window.__hook&&window.__hook();
      if(!h) return {noHook:true};
      const P=h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
      if(!P) return {noPage:true};
      const vals=[];
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(t._dim) vals.push(String(t.text)); }));
      return {page:P.name, objects:(P.objects||[]).length,
              models:(P.dxf&&P.dxf.dims||[]).length, sampleValues:vals.slice(0,4)};
    });
    console.log('   ', tag, JSON.stringify(r));
    return r;
  };

  console.log('1. open the OLD build and import a drawing');
  await load(_p.join(require('./harness').ROOT,'src','base.html'));
  await page.evaluate(()=>{ const h=window.__hook(); h.createProject(); });
  await page.waitForTimeout(500);
  const sh=await page.$('text=Sheet 01'); if(sh && await sh.isVisible()) await sh.click();
  await page.waitForTimeout(400);
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await page.waitForTimeout(1500);
  await state('old build after import:');

  console.log('2. now open the NEW build in the SAME browser');
  await load(require('./harness').APP);
  const after=await state('new build on first load:');

  console.log('3. press STYLIZE on what it restored');
  const btn=await page.$('#btnStylize');
  if(btn && await btn.isVisible()){ await btn.click(); await page.waitForTimeout(900); }
  await state('after STYLIZE:');

  console.log('4. does re-importing the file fix it?');
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await page.waitForTimeout(1500);
  await page.click('#btnStylize'); await page.waitForTimeout(900);
  await state('after re-import + STYLIZE:');
  await b.close();
})();
