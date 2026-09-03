const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// Four line styles, each shown as the line it draws. The section line is not
// among them: a cutting plane is drawn by its marker, from the marker's model.
// And the description page names five things and must draw five.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);

  // the description page legend
  const d=await p.$('text=Description'); if(d) await d.click();
  await p.waitForTimeout(800);
  const legend=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const z=(P._zones||[]).filter(x=>/^lg/.test(x.key));
    // rows must not sit on top of one another
    const ys=z.map(x=>x.y).sort((a,b)=>a-b);
    let closest=1e9;
    for(let i=1;i<ys.length;i++) closest=Math.min(closest, ys[i]-ys[i-1]);
    /* Every line sample must run the same length, or the column looks ragged and
       a shorter one reads as a different kind of line rather than a different
       pattern. Measured from the drawn segments themselves. */
    const spans=(P._legendSpans||[]);
    return {labels:z.map(x=>x.val), closestRowsMM:+closest.toFixed(2),
            sampleEndsMM:spans.map(v=>+v.toFixed(2)),
            roomForDescriptionMM:+((P._descBodyY||0)-(P._legendTopY||0)).toFixed(1)};
  });
  console.log('legend rows      :', JSON.stringify(legend.labels));
  console.log('closest two rows :', legend.closestRowsMM, 'mm apart');
  console.log('every sample the same length:',
    new Set(legend.sampleEndsMM).size===1, JSON.stringify(legend.sampleEndsMM));
  console.log('room above the legend for the description:',
    legend.roomForDescriptionMM, 'mm');

  // the line style menu
  const sh=await p.$('text=Sheet 01'); if(sh) await sh.click(); await p.waitForTimeout(600);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.setSelection((P.objects||[]).slice(0,3).map(o=>o.id)); h.render(); });
  const st=await p.$('#stage'); const bb=await st.boundingBox();
  await p.mouse.click(bb.x+bb.width/2, bb.y+bb.height/2, {button:'right'});
  await p.waitForTimeout(600);
  const menu=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('[data-lt]')];
    return rows.map(e=>({name:e.textContent.trim(),
                         showsTheLine:!!e.querySelector('svg line')}));
  });
  console.log('line styles      :', JSON.stringify(menu.map(x=>x.name)));
  console.log('each shows its own line:', menu.every(x=>x.showsTheLine));
  console.log('no section line offered:', !menu.some(x=>/section/i.test(x.name)));

  // the switch hint
  await p.keyboard.press('Escape');
  await p.click('#btnFormat'); await p.waitForTimeout(800);
  const hint=await p.evaluate(()=>{
    const sw=document.querySelector('#fAnsiR');
    const row=sw && sw.closest('.tg-row');
    const s=row && row.querySelector('span');
    return s? s.textContent.trim() : '(none)';
  });
  console.log('switch hint      :', JSON.stringify(hint));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
