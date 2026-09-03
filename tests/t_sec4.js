const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'sec_test.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {found:(P.dxf.secs||[]).map(s=>({letter:s.letter,
      views:s.ends.map(e=>e.view.map(v=>Math.round(v))),
      ends:s.ends.map(e=>e.p.map(v=>+v.toFixed(1)))}))};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
