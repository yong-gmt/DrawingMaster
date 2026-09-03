const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
const APP=require('./harness').APP;
// Click the switches the way a person does, and read the answer off the pixels:
// the drawing must change when a switch is on and not when it is off.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(1800);

  /* Comparing the whole canvas was the wrong measurement: changing the text size
     also restyles the LINEAR dimensions, so the picture moves either way and the
     switch looks broken when it is not. Look only at the annotation the switch
     is supposed to govern. */
  const snapshotOf=(kind)=>p.evaluate((kind)=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const isRound=(id)=>(P.dxf.dims||[]).some(m=>m.id===id &&
      (m.kind==='radial'||m.kind==='diameter'));
    const S=[];
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>{
        const mine = kind==='radius' ? (q._dim && isRound(q._dim)) : !!q._sec;
        if(mine) S.push('P'+JSON.stringify(q.pts)); });
      (o.prims.texts||[]).forEach(t=>{
        const mine = kind==='radius' ? (t._dim && isRound(t._dim)) : !!t._sec;
        if(mine) S.push('T'+[t.x.toFixed(3),t.y.toFixed(3),t.h,t.text].join(',')); });
    });
    return S.sort().join(';');
  }, kind);

  // settle the drawing first, so later differences come from the switches only
  await p.click('#btnStylize'); await p.waitForTimeout(800);

  const openPanel=async()=>{ await p.click('#btnFormat'); await p.waitForTimeout(700); };
  const setSize=async(pt)=>{ await p.evaluate((v)=>{
      const s=document.querySelector('#fSize'); s.value=v;
      s.dispatchEvent(new Event('input',{bubbles:true})); }, pt); };
  const savePanel=async()=>{ await p.click('#fSave'); await p.waitForTimeout(600); };

  let size=10;
  for(const [name, sel, kind] of [['ANSI Radius','#fAnsiR','radius'],
                                  ['ANSI Section','#fAnsiS','section']]){
    // switch it OFF, change the text size, press STYLIZE:
    // this kind of annotation must not move at all
    await openPanel();
    const wasOn=await p.$eval(sel, el=>el.classList.contains('on'));
    if(wasOn) await p.click(sel);
    const nowOff=await p.$eval(sel, el=>!el.classList.contains('on'));
    size+=4; await setSize(size); await savePanel();
    const before=await snapshotOf(kind);
    await p.click('#btnStylize'); await p.waitForTimeout(900);
    const afterOff=await snapshotOf(kind);

    // switch it back ON and press again: now it must move
    await openPanel(); await p.click(sel); await savePanel();
    await p.click('#btnStylize'); await p.waitForTimeout(900);
    const afterOn=await snapshotOf(kind);

    console.log(name.padEnd(13),
      '| the click turned it off:', nowOff,
      '| untouched while OFF:', before===afterOff,
      '| restyled while ON:', afterOn!==afterOff);
  }
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
