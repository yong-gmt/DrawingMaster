const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
/* The decimals set in Format Config must reach EVERY dimension, including the
   ones whose source file rounded hardest.
   fixtures/synthetic/decimals.dxf (tools/mkdecimals.js) prints "24" beside a span
   that is really 24.37. That is 0.37 out, and the old test for "is this text this
   measurement" was one percent - 0.24 - so the answer was no, the pair was never
   recognised as a dimension at all, and STYLIZE left the text exactly as the file
   had printed it. Set two decimals and nothing happened to it.
   This measures what is DRAWN, not what the models say.

   Note what is NOT tested here: that 24 becomes 24.37. It must not. The geometry
   is how a dimension is FOUND; the number beside it is what the drawing SAYS, and
   STYLIZE changes the format of a dimension, never its data. */
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('decimals.dxf'));
  await p.waitForTimeout(1900);

  const run=async(want)=>{
    await p.evaluate(w=>{ const h=window.__hook(); h.store.format.decimals=w; }, want);
    await p.click('#btnStylize'); await p.waitForTimeout(1600);
    return p.evaluate(()=>{ const h=window.__hook();
      const pg=h.store.pages.find(x=>x.id===h.store.activeId);
      const out=[]; (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>out.push(String(t.text))));
      return out.sort(); });
  };
  /* how many places each drawn number actually shows */
  const places=s=>{ const m=/(\d+)\.(\d+)/.exec(s); return m? m[2].length : (/\d/.test(s)?0:-1); };

  let bad=0, lines=[];
  for(const want of [2,0,3,1]){
    const drawn=await run(want);
    const wrong=drawn.filter(s=>places(s)!==want);
    if(drawn.length!==4) wrong.push('EXPECTED 4 DIMENSIONS, GOT '+drawn.length);
    if(wrong.length) bad++;
    lines.push('  decimals '+want+' -> '+JSON.stringify(drawn)
               +(wrong.length? '   WRONG: '+JSON.stringify(wrong) : ''));
  }
  console.log('four dimensions, one of them printed "24" for a 24.37 span:');
  lines.forEach(l=>console.log(l));
  console.log('settings that did not reach every dimension:', bad);
  console.log('the wrapper the file added is still there:',
    (await run(2)).some(s=>s==='2x 24.00'));
  /* And the VALUE is the file's, not the vectors'. decimals.dxf deliberately spans
     24.37 mm while printing "24": STYLIZE formats what the drawing says, it does
     not restate it. A drawing's numbers were checked by whoever drew it. */
  console.log('values are still the file’s own:',
    JSON.stringify((await run(2)).sort()));
  /* And a file no model can claim: architectural ticks instead of arrowheads, so
     nothing is recognised as a dimension at all. Those numbers still have to obey
     the sheet's decimals - re-printed as the file wrote them, not re-measured. */
  const p2=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  await p2.goto('file://'+APP); await p2.waitForTimeout(900);
  await p2.evaluate(()=>window.__hook().createProject()); await p2.waitForTimeout(700);
  const sh2=await p2.$('text=Sheet 01'); if(sh2&&await sh2.isVisible()) await sh2.click();
  await p2.waitForTimeout(400);
  await p2.click('#btnImport');
  await p2.setInputFiles('#fileInput', H.fixture('dec_tick.dxf'));
  await p2.waitForTimeout(1900);
  const tick=async(want)=>{
    await p2.evaluate(w=>{ const h=window.__hook(); h.store.format.decimals=w; }, want);
    await p2.click('#btnStylize'); await p2.waitForTimeout(1600);
    return p2.evaluate(()=>{ const h=window.__hook();
      const pg=h.store.pages.find(x=>x.id===h.store.activeId);
      const o=[]; (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>o.push(String(t.text))));
      return o.sort(); });
  };
  const t2=await tick(2), t0=await tick(0), t2b=await tick(2);
  console.log('ticks, nothing modelled:');
  console.log('  models recognised:', await p2.evaluate(()=>{ const h=window.__hook();
    return (h.dimModels(h.store.pages.find(x=>x.id===h.store.activeId))||[]).length; }));
  console.log('  decimals 2 ->', JSON.stringify(t2));
  console.log('  decimals 0 ->', JSON.stringify(t0));
  console.log('  back to 2  ->', JSON.stringify(t2b),
              ' same as the first time:', JSON.stringify(t2)===JSON.stringify(t2b));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
