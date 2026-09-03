const {open,loadDxf}=require('./harness');
// The title-block area is worked out as the bounding box of every text on a
// "title" layer. One stray text on that layer - anywhere on the sheet - stretches
// the box across the drawing and every dimension value inside it is left alone.
// That is a whole sheet coming back half-resized because of one label.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // put ONE title-layer text out in the drawing, as a real file easily does
    const bb=h.entitiesBBox(P);
    P.dxf.texts.push({ x:bb.minx+2, y:bb.maxy-2, h:2, text:'PART 1', rot:0, align:0,
                       _layer:'Title (ISO)' });
    h.buildObjects(P);
    h.store.format.fontSize=14;
    document.querySelector('#btnStylize').click();
    return true;
  });
  await pg.waitForTimeout(1200);
  const out=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+(14*25.4/72).toFixed(3);
    let values=0, wrong=0;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(!t._dim) return; values++;
      if(Math.abs(t.h-want)>0.01) wrong++; }));
    const box=h.sheetFurnitureBox? h.sheetFurnitureBox(P) : null;
    return {values, leftAtTheOldSize:wrong,
            furnitureBox: box? {w:+(box.x1-box.x0).toFixed(0), h:+(box.y1-box.y0).toFixed(0)} : null};
  });
  console.log('one stray "Title" text on the drawing ->', JSON.stringify(out));
  console.log('dimension values left unresized:', out.leftAtTheOldSize);
  await b.close();
})();
