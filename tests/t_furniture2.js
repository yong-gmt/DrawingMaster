const {open,loadDxf}=require('./harness');
// A dimension value must be resized wherever it sits - even right on top of the
// title block - and a stray title-layer text must not turn the whole sheet into
// furniture.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,'Head-back.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // (1) one stray title text out on the drawing
    const bb=h.entitiesBBox(P);
    P.dxf.texts.push({x:bb.minx+2, y:bb.maxy-2, h:2, text:'PART 1', rot:0, align:0,
                      _layer:'Title (ISO)'});
    // (2) drag one dimension value right into the title block
    const m=(P.dxf.dims||[]).find(x=>x.ok && x.kind==='linear');
    h.buildObjects(P);
    const tb=h.tbRect();
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._dim===m.id){ t.x=tb.x+20; t.y=tb.y+10; } }));
    h.store.format.fontSize=14;
    document.querySelector('#btnStylize').click();
    return m.id;
  });
  await pg.waitForTimeout(1200);
  const out=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+(14*25.4/72).toFixed(3);
    let values=0, wrong=0;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!t._dim) return; values++;
      if(Math.abs(t.h-want)>0.01) wrong++; }));
    const box=h.sheetFurnitureBox(P);
    return {dimensionValues:values, leftAtTheOldSize:wrong,
            furnitureBox: box? 'kept' : 'rejected as too big'};
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
