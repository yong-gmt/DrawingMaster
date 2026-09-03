const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// A switch that does nothing is a lie. Turn each one off and check that STYLIZE
// really leaves that kind of annotation alone.
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
  await p.waitForTimeout(1800);

  const snap=(what)=>p.evaluate((what)=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[];
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>{
        const mine = what==='rad'
          ? (q._dim && (P.dxf.dims||[]).some(m=>m.id===q._dim && (m.kind==='radial'||m.kind==='diameter')))
          : !!q._sec;
        if(mine) S.push(JSON.stringify(q.pts)); });
      (o.prims.texts||[]).forEach(t=>{
        const mine = what==='rad'
          ? (t._dim && (P.dxf.dims||[]).some(m=>m.id===t._dim && (m.kind==='radial'||m.kind==='diameter')))
          : !!t._sec;
        if(mine) S.push('T'+[t.x.toFixed(3),t.y.toFixed(3),t.h,t.text].join(',')); });
    });
    return S.sort().join(';');
  }, what);

  for(const [name, key, what] of [['ANSI Radius','ansiRadius','rad'],
                                  ['ANSI Section','ansiSection','sec']]){
    await p.evaluate((k)=>{ const f=window.__hook().store.format;
      f.ansiRadius=true; f.ansiSection=true; f.fontSize=10; }, key);
    await p.click('#btnStylize'); await p.waitForTimeout(700);
    // switch it OFF, change the text size, and press again
    await p.evaluate((k)=>{ const f=window.__hook().store.format; f[k]=false; f.fontSize=18; }, key);
    const before=await snap(what);
    await p.click('#btnStylize'); await p.waitForTimeout(700);
    const afterOff=await snap(what);
    // switch it back ON and press again
    await p.evaluate((k)=>{ window.__hook().store.format[k]=true; }, key);
    await p.click('#btnStylize'); await p.waitForTimeout(700);
    const afterOn=await snap(what);
    console.log(name+': off -> untouched:', before===afterOff,
                '| on -> restyled:', afterOn!==afterOff);
  }

  // the switch colour, and the size hint
  await p.evaluate(()=>document.querySelector('#btnFormat').click());
  await p.waitForTimeout(700);
  const ui=await p.evaluate(()=>{
    const sw=document.querySelector('#fAnsiR');   // the ANSI Radius switch
    const on=sw.classList.contains('on');
    const col=getComputedStyle(sw).backgroundColor;
    const ink=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return {on, col, ink};
  });
  console.log('switch colour when on:', ui.col, '| the app accent is', ui.ink);
  console.log('errors:', errs.length, errs.slice(0,2));
  fs.writeFileSync('fmt.png', await p.screenshot());
  await b.close();
})();
