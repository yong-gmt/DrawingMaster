const {open,loadDxf}=require('./harness');
// After an import, geometry must arrive as separate pieces - no guessed grouping.
// A dimension, a section marker and a balloon are each still one object, because
// the drawing says so rather than a heuristic guessing it.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const objs=P.objects||[];
    const groups={};
    objs.forEach(o=>{ if(o.group) (groups[o.group]||(groups[o.group]=[])).push(o); });
    const sizes=Object.values(groups).map(a=>a.length);
    // a group that holds plain geometry is a guess we no longer make
    const guessed=Object.values(groups).filter(a=>a.some(o=>!o._dim&&!o._sec&&!o._bal));
    // clicking one plain stroke should select that stroke, not a whole view
    const plain=objs.find(o=>!o._dim&&!o._sec&&!o._bal&&(o.prims.polys||[]).length);
    const pl=plain.prims.polys[0];
    const mid=[(pl.pts[0][0]+pl.pts[1][0])/2+(plain.dx||0),
               (pl.pts[0][1]+pl.pts[1][1])/2+(plain.dy||0)];
    const hit=h.objAtPoint(mid[0],mid[1]);
    const picked=hit? [...h.expandGroup(new Set([hit.id]))].length : 0;
    return {objects:objs.length, groups:Object.keys(groups).length,
            biggestGroup:sizes.length?Math.max(...sizes):0,
            groupsOfPlainGeometry:guessed.length,
            clickingOneStrokeSelects:picked};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();
