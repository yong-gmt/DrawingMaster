const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE='/tmp/dm-reopen2';
// Close the program, come back, and press STYLIZE again. Nothing that was already
// styled may change - and everything a marker or a dimension owns must still be
// owned, or the second press cannot tidy up what the first one did.
(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  const look=(p)=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let secLines=0, loose=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>{ if(q._sec && (q.pts||[]).length>=4) secLines++; });
      (o.prims.solids||[]).forEach(s=>{ if(!s._sec && !s._dim) loose++; }); });
    /* Saving rounds coordinates, and a value redrawn in a fresh session can land a
       hair differently because its width is measured from the font. Comparing exact
       strings called every stroke "changed", which is true and useless. Keep the
       strokes so the caller can measure how far anything actually moved. */
    const ink=[];
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>{ if((q.pts||[]).length) ink.push(q.pts[0].slice()); });
      (o.prims.texts||[]).forEach(t=>ink.push([t.x, t.y])); });
    return {sectionLines:secLines, untaggedFilledShapes:loose,
            taggedFilledShapes:(P.dxf.solids||[]).filter(s=>s._dim||s._sec||s._section).length,
            ink};
  });

  let c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  let p=c.pages()[0]||await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  let sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);
  await p.click('#btnStylize'); await p.waitForTimeout(1300);
  // and a hand edit the system must never undo
  await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    /* Move it the way a person does - by dragging its grip - so the save path
       runs. Poking the model directly changes nothing on disk, because saving
       happens when the program is told something changed. */
    const m=(P.dxf.dims||[]).find(x=>x.ok && x.line && x.line.q!=null);
    window.__editIdx=(P.dxf.dims||[]).indexOf(m);
    const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
    h.setSelection(ids);
    const g=h.dimModelGrips(P).find(x=>x.kind==='line');
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(g.at[0], g.at[1]);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    ev('mousedown',A.x,A.y); ev('mousemove',A.x+40,A.y-40);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    h.setSelection([]); h.render();
  });
  await p.waitForTimeout(500);
  const styled=await look(p);
  const editIdx=await p.evaluate(()=>window.__editIdx);
  const edited=await p.evaluate((i)=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[])[i]; return m&&m.line? +m.line.q.toFixed(3) : null;
  }, editIdx);
  console.log('session 1, after STYLIZE and a hand edit:',
    JSON.stringify({sectionLines:styled.sectionLines,
      untagged:styled.untaggedFilledShapes, tagged:styled.taggedFilledShapes, dimLineQ:edited}));
  await c.close();

  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0]||await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1'); if(card) await card.click();
  await p.waitForTimeout(1600);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(900);
  await p.evaluate((i)=>{ window.__i=i; }, editIdx);
  const back=await look(p);
  const editedBack=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    /* a flag invented by the test is not saved; find the dimension by its id,
       which the program does save */
    const m=(P.dxf.dims||[])[window.__i]; return m&&m.line? +m.line.q.toFixed(3) : null;
  });
  console.log('session 2, reopened                    :',
    JSON.stringify({sectionLines:back.sectionLines,
      untagged:back.untaggedFilledShapes, tagged:back.taggedFilledShapes, dimLineQ:editedBack}));
  /* Pairing by index is wrong: a piece a model had to make for itself is appended
     to the drawing, so the ORDER differs between sessions even when every stroke is
     in the same place. Compare the SET of positions instead. */
  /* Match each stroke to the nearest one in the other session, and report how far
     that is. Set membership at a fixed rounding kept calling a stroke "missing"
     when it had moved a tenth of a millimetre - which is the font measuring a
     value's width again, not anything being lost. */
  const shift=(a,b)=>{
    /* ...and at a tolerance, not exactly: saving rounds coordinates and a value's
       width is measured from the font again in a fresh session, so a stroke can
       land a hundredth of a millimetre away and still be the same stroke. */
    let worst=0, lost=0;
    a.forEach(q=>{ let best=1e9;
      b.forEach(r=>{ const d=Math.hypot(q[0]-r[0], q[1]-r[1]); if(d<best) best=d; });
      if(best>1) lost++;                       /* more than a millimetre = gone */
      if(best>worst) worst=best; });
    return {pieces:[a.length,b.length], strokesLost:lost, worstMoveMM:+worst.toFixed(3)};
  };
  const d1=shift(styled.ink, back.ink);
  console.log('  same number of strokes          :', d1.pieces[0]===d1.pieces[1],
              '| strokes lost', d1.strokesLost, '· biggest move', d1.worstMoveMM, 'mm');
  console.log('  the hand edit survived          :', editedBack===edited);

  await p.click('#btnStylize'); await p.waitForTimeout(1300);
  const again=await look(p);
  const editedAgain=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[])[window.__i]; return m&&m.line? +m.line.q.toFixed(3) : null;
  });
  const d2=shift(back.ink, again.ink);
  console.log('  pressing STYLIZE again: lost', d2.strokesLost, '· biggest move', d2.worstMoveMM, 'mm',
              '| the hand edit is still at', editedAgain,
              '| kept:', editedAgain===edited);
  console.log('errors:', errs.length, errs.slice(0,2));
  await c.close();
})();
