const {open,loadDxf}=require('./harness');
// A dimension the model could not fit is left alone geometrically - that is the
// point of the fit check. Its VALUE must still be resized: changing a text height
// cannot break a drawing, and leaving it is what makes a sheet come back with
// half its numbers at one size and half at another.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // spoil a few models so they cannot be trusted, the way a real odd drawing does
    const dims=(P.dxf.dims||[]).filter(m=>m.kind==='linear').slice(0,3);
    dims.forEach(m=>{ m.ok=false; });
    h.store.format.fontSize=14;
    document.querySelector('#btnStylize').click();
    return dims.map(m=>m.id);
  });
  await pg.waitForTimeout(1000);
  const out=await pg.evaluate((ids)=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const want=+(14*25.4/72).toFixed(3);
    const rows=[];
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._dim && ids.indexOf(t._dim)>=0)
        rows.push({text:String(t.text), h:+(+t.h).toFixed(2), atWanted:Math.abs(t.h-want)<0.01});
    }));
    return {want, rows};
  }, r);
  console.log(dxf, '| wanted', out.want, 'mm');
  console.log('   values of dimensions that could not be modelled:',
              JSON.stringify(out.rows));
  console.log('   all at the wanted size:', out.rows.length>0 && out.rows.every(x=>x.atWanted));
  await b.close();
 }
})();
