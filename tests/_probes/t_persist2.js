const _p=require('path');
const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  const dump=async(tag)=>{
    const r=await page.evaluate(()=>{
      const h=window.__hook&&window.__hook();
      const ls=Object.keys(localStorage).map(k=>k+'='+(localStorage[k]||'').length+'B');
      if(!h||!h.store) return {tag:'no store', ls};
      return { ls, activeId:h.store.activeId,
               pages:(h.store.pages||[]).map(p=>p.id+':'+p.type+':'+p.name),
               importVisible: !!document.querySelector('#btnImport') &&
                 getComputedStyle(document.querySelector('#btnImport')).display!=='none' };
    });
    console.log(tag, JSON.stringify(r));
  };
  await page.goto('file://'+_p.join(require('./harness').ROOT,'src','base.html'));
  await page.waitForTimeout(900);
  await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  await dump('old build, project made :');
  await page.goto('file://'+require('./harness').fixture(require('./harness').APP));
  await page.waitForTimeout(1200);
  await dump('new build, same browser :');
  fs.writeFileSync('persist.png', await page.screenshot());
  await b.close();
})();
