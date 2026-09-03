const {open,loadDxf}=require('./harness');
// One switch. ON: STYLIZE restyles the drawing and sets the text size.
// OFF: the drawing is left exactly as the file drew it, and only the text size
// changes - which is what makes "off" useful rather than "do nothing".
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  const shot=()=>pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[]; let vals=0, wrong=0;
    const want=+((h.store.format.fontSize||10)*25.4/72).toFixed(3);
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(q=>S.push(JSON.stringify(q.pts)));
      (o.prims.texts||[]).forEach(t=>{
        S.push(t.x.toFixed(2)+','+t.y.toFixed(2)+','+t.text);
        if(!t._dim) return; vals++; if(Math.abs(t.h-want)>0.01) wrong++; });
    });
    return {ink:S.sort().join(';'), values:vals, valuesAtWrongSize:wrong,
            switches:{radius:h.store.format.ansiRadius, section:h.store.format.ansiSection}};
  });

  // OFF: change the size and press
  await pg.evaluate(()=>{ const f=window.__hook().store.format;
    f.ansiRadius=false; f.ansiSection=false; f.fontSize=16; });
  const before=await shot();
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1000);
  const off=await shot();

  // ON: press again
  await pg.evaluate(()=>{ const f=window.__hook().store.format; f.ansiRadius=true; f.ansiSection=true; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1000);
  const on=await shot();

  console.log(dxf);
  console.log('  OFF: text at the chosen size:', off.valuesAtWrongSize===0,
              '| the drawing itself changed:', off.ink!==before.ink);
  console.log('  ON : text at the chosen size:', on.valuesAtWrongSize===0,
              '| the drawing was restyled   :', on.ink!==off.ink);
  await b.close();
 }
})();
