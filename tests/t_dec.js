const {open,loadDxf}=require('./harness');
// Format Config says how many decimals a value carries. Does the drawing obey?
(async()=>{
 for(const dxf of ['Head-back.dxf','exploded.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  for(const dec of [1,3]){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,dxf);
    await pg.evaluate((d)=>{ window.__hook().store.format.decimals=d; }, dec);
    await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    const r=await pg.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const vals=[];
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(t._dim) vals.push(String(t.text)); }));
      return vals;
    });
    // exactly `dec` digits after the point - no more, no fewer
    const want=new RegExp('\\d+\\.\\d{'+dec+'}(?!\\d)');
    const bad=r.filter(v=>/\d/.test(v) && !want.test(v));
    console.log(dxf, 'decimals='+dec, '| values', r.length,
      '| not following the setting:', bad.length, bad.slice(0,4));
    await b.close();
  }
 }
})();
