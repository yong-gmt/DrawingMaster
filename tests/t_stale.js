const _p=require('path');
const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// The returning user's path: work in the OLD build, then open the NEW one in the
// same browser and click the saved project - no re-import.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  const open=async(f)=>{ await page.goto('file://'+require('./harness').fixture(f)); await page.waitForTimeout(1000); };
  const look=async(tag)=>{
    const r=await page.evaluate(()=>{
      const h=window.__hook&&window.__hook();
      const P=h&&h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
      if(!P) return {none:true};
      const v=[]; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(t._dim) v.push(String(t.text)); }));
      return {models:(P.dxf&&P.dxf.dims||[]).length, values:v.slice(0,5),
              decimals:h.store.format.decimals};
    });
    console.log('  '+tag, JSON.stringify(r)); return r;
  };
  // 1. old build: import and save
  await open(_p.join(require('./harness').ROOT,'src','base.html'));
  await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  let sh=await page.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await page.waitForTimeout(400);
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await page.waitForTimeout(1600);
  await look('old build, imported   :');
  await page.evaluate(()=>window.__hook().persist&&window.__hook().persist());
  await page.waitForTimeout(400);

  // 2. new build, same browser: click the saved project card
  await open(require('./harness').APP);
  const card=await page.$('.proj-card, [data-proj], .card');
  if(card) await card.click(); else await page.click('text=Project 1');
  await page.waitForTimeout(1200);
  let sh2=await page.$('text=Sheet 01'); if(sh2&&await sh2.isVisible()) await sh2.click();
  await page.waitForTimeout(500);
  await look('new build, reopened   :');
  // 3. ask for a different number of decimals and press STYLIZE
  await page.evaluate(()=>{ window.__hook().store.format.decimals=1; });
  await page.click('#btnStylize'); await page.waitForTimeout(1000);
  const r=await look('after STYLIZE (dec=1):');
  fs.writeFileSync(require('./harness').out('stale.png'), await page.locator('canvas').first().screenshot());
  const bad=(r.values||[]).filter(v=>/\d/.test(v) && !/\d+\.\d(?!\d)/.test(v));
  console.log('  values not following the decimals setting:', bad.length, bad);
  await b.close();
})();
