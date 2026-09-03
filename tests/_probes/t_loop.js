const {open,loadDxf}=require('./harness');
// STYLIZE must not stop while it can still fix something, and pressing it again
// must RE-SCAN rather than replay what it decided the first time.
(async()=>{
 for(const dxf of ['exploded.dxf','Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const snap=()=>pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[]; (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>S.push('P|'+JSON.stringify(p.pts)));
      (o.prims.texts||[]).forEach(t=>S.push('T|'+[t.x.toFixed(3),t.y.toFixed(3),t.h,t.text].join(','))); });
    return S.sort().join(';');
  });
  const state=()=>pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {models:(P.dxf.dims||[]).filter(m=>m.ok).length,
            leftover:h.stylizeLeftovers(P)};
  });
  // deliberately throw away every model, as if the drawing had never been read,
  // then press STYLIZE and see whether it rebuilds them from the geometry alone
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // forget everything that was worked out at import - tags included - so the
    // drawing is exactly what it would be if nobody had ever recognised it
    P.dxf.dims=[];
    (P.dxf.polys||[]).forEach(p=>{ delete p._dim; delete p._dimPart; delete p._role; delete p._arrow; });
    (P.dxf.texts||[]).forEach(t=>{ delete t._dim; delete t._dimPart; delete t._role; });
    (P.dxf.solids||[]).forEach(s=>{ delete s._dim; });
    h.buildObjects(P); h.render();
  });
  const before=await state();
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const after1=await state(); const s1=await snap();
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const after2=await state(); const s2=await snap();
  console.log(dxf);
  console.log('  models after wiping them  :', before.models);
  console.log('  after pressing STYLIZE    :', after1.models,
              '| values still unmatched:', after1.leftover.length, after1.leftover.slice(0,4));
  console.log('  after pressing it again   :', after2.models,
              '| drawing moved:', s1!==s2);
  await b.close();
 }
})();
