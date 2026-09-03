const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.secs||[]).map(s=>({id:s.id, letter:s.letter,
      ends:s.ends.map(e=>({p:e.p.map(v=>+v.toFixed(2)), view:e.view.map(v=>+v.toFixed(3))})),
      arrow:s.arrow, labels:s.labelIds.length}));
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
