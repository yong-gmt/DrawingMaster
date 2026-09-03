const {open,loadDxf}=require('./harness');
// Read ONLY what is actually drawn - the primitives on the canvas - and ignore the
// model entirely. If the model says one thing and the prims say another, the screen
// follows the prims and every model-based test I have written is worthless.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.ok&&x.kind==='radial');
    const drawn=[];
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._dim!==m.id) return;
      drawn.push({role:p._role, n:p.pts.length,
        pts:p.pts.map(q=>[+(q[0]+(o.dx||0)).toFixed(2), +(q[1]+(o.dy||0)).toFixed(2)]),
        arrow:p._arrow||null}); }));
    const g=h.dimGeomOf(m);
    return {id:m.id, centre:m.centre.map(v=>+v.toFixed(2)), r:+m.radius.toFixed(2),
      MODEL:g.segs.filter(s=>!s.hidden).map(s=>({role:s.role,
        pts:(s.pts||[s.a,s.b]).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]),
        arrow:s.arrow||null})),
      DRAWN:drawn};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
