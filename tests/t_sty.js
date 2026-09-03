const {open,loadDxf}=require('./harness');
const SNAP=()=>{
  const h=window.__hook(); const pg=h.activePage();
  const S=[];
  (pg.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>S.push([p._dim||'', p._role||'', (o.dx||0),(o.dy||0),
      ...p.pts.flat()].join(',')));
    (o.prims.texts||[]).forEach(t=>S.push(['T',t._dim||'',t.x,t.y,t.rot,t.h,t.text].join(',')));
  });
  return S;
};
const OBJLINES=()=>{ // object (Visible-layer) geometry must never be touched
  const h=window.__hook(); const pg=h.activePage(); const S=[];
  (pg.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
    if(p._dim||p._section) return; S.push(p.pts.flat().join(',')); }));
  return S;
};
// order-insensitive: STYLIZE may add primitives, which would shift a positional
// comparison and cry wolf about lines that never moved
const drift=(a,b)=>{ const m=new Map();
  a.forEach(k=>m.set(k,(m.get(k)||0)+1));
  let n=0; b.forEach(k=>{ const c=m.get(k)||0; if(c) m.set(k,c-1); else n++; });
  m.forEach(c=>n+=c); return n; };
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const obj0=await pg.evaluate(OBJLINES);
  const s0=await pg.evaluate(SNAP);
  await pg.evaluate(()=>{ const f=window.__hook().store.format; f.ansiRadius=true; f.ansiSection=true; });
  await pg.evaluate(()=>{ window.__hook().store; });
  // call directly through the app's own button handler if present, else the fn
  const ran=await pg.evaluate(()=>{ const b=document.querySelector("#btnStylize"); if(!b) return "no button"; b.click(); return true; });
  const s1=await pg.evaluate(SNAP);
  await pg.evaluate(()=>document.querySelector("#btnStylize").click());
  const s2=await pg.evaluate(SNAP);
  const obj1=await pg.evaluate(OBJLINES);
  console.log(dxf, JSON.stringify({stylize:ran, changedByPass1:drift(s0,s1), stylizeDrift:drift(s1,s2),
    objectLinesChanged:drift(obj0,obj1), prims:s1.length}));
  await b.close();
 }
})();
