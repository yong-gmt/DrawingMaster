const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(),P=h.store.pages.find(x=>x.id===h.store.activeId);
    let empty=0, emptyObj=0;
    (P.objects||[]).forEach(o=>{ let all=true,any=false;
      (o.prims.polys||[]).forEach(p=>{ any=true; if(!p.pts.length) empty++; else all=false; });
      if(any&&all) emptyObj++; });
    // objBBox must not blow up on them
    let nullbb=0; (P.objects||[]).forEach(o=>{ if(!h.objBBox(o)) nullbb++; });
    return {empty, emptyObj, nullbb, hit:!!h.objAtPoint(0,0)===false};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
