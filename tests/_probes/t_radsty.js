const {open,loadDxf}=require('./harness');
// What STYLIZE does to a radius dimension, measured.
const SNAP=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  return (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').map(m=>{
    const g=h.dimGeomOf(m);
    return {id:m.id, str:g.text.str, text:[+g.text.x.toFixed(2),+g.text.y.toFixed(2)],
      h:+m.text.h.toFixed(2), landY:+m.land.y.toFixed(2), side:m.land.side,
      off:m.land.off==null?null:+m.land.off.toFixed(2),
      elbow:g.elbow.map(v=>+v.toFixed(2)), far:g.foreshortened,
      arrowAtArc:+Math.abs(Math.hypot(g.segs[0].b[0]-m.centre[0],g.segs[0].b[1]-m.centre[1])-m.radius).toFixed(4)};
  });
};
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  const a=await pg.evaluate(SNAP);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const c=await pg.evaluate(SNAP);
  const moved=a.map((x,i)=>({id:x.id,
    dText:+Math.hypot(c[i].text[0]-x.text[0], c[i].text[1]-x.text[1]).toFixed(2),
    dElbow:+Math.hypot(c[i].elbow[0]-x.elbow[0], c[i].elbow[1]-x.elbow[1]).toFixed(2),
    hBefore:x.h, hAfter:c[i].h, offBefore:x.off, offAfter:c[i].off,
    arrowAfter:c[i].arrowAtArc}));
  console.log(dxf);
  moved.forEach(m=>console.log(' ', JSON.stringify(m)));
  await b.close();
 }
})();
