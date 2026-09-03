const {open,loadDxf}=require('./harness');
// Run STYLIZE on a drawing built to break the rules and see what it does.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await loadDxf(pg,'odd_test.dxf');
  const snap=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const notes=[], geom=[];
    (P.objects||[]).forEach(o=>{
      (o.prims.texts||[]).forEach(t=>{ if(/typ|THRU/.test(String(t.text)))
        notes.push([String(t.text), +t.x.toFixed(3), +t.y.toFixed(3), +t.h.toFixed(2), t.rot||0]); });
      (o.prims.polys||[]).forEach(p=>{ if(p._layer==='Visible')
        geom.push(JSON.stringify(p.pts.map(q=>q.map(v=>+v.toFixed(3))))); });
    });
    return {notes, geom};
  };
  const before=await pg.evaluate(snap);
  const built=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {dims:(P.dxf.dims||[]).map(m=>({kind:m.kind, ok:m.ok,
              r:m.radius?+m.radius.toFixed(2):null})),
            secs:(P.dxf.secs||[]).map(s=>s.letter),
            rounds:(P.dxf.polys||[]).filter(p=>p._round).length};
  });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const after=await pg.evaluate(snap);
  const same=(a,c)=>JSON.stringify(a)===JSON.stringify(c);
  console.log('dimensions modelled  :', JSON.stringify(built.dims));
  console.log('section letters found:', JSON.stringify(built.secs));
  console.log('round entities kept  :', built.rounds);
  // a note may be RE-SIZED like any annotation, but it must not be moved, turned,
  // or have geometry reshaped around it as if it were a dimension
  const pos=(a)=>a.map(x=>[x[0],x[1],x[2],x[4]]);
  console.log('notes not moved or turned:', same(pos(before.notes), pos(after.notes)));
  console.log('note heights             :', JSON.stringify(before.notes.map(x=>x[3])),
              '->', JSON.stringify(after.notes.map(x=>x[3])));
  console.log('object geometry untouched:', same(before.geom, after.geom));
  console.log('errors               :', errs.length, errs.slice(0,2));
  await b.close();
})();
