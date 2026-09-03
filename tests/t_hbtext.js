const {open,loadDxf}=require('./harness');
// Which texts does STYLIZE resize? It should only ever touch its own annotation -
// dimension values and section letters. Notes, view labels, the drawing frame's
// zone letters and the title block belong to the drawing, not to STYLIZE.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const grab=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[]; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>
      out.push({s:String(t.text).slice(0,22), h:+t.h.toFixed(2),
                kind: t._dim?'dimension' : t._sec?'section letter' : 'the drawing itself'})));
    return out; };
  const a=await pg.evaluate(grab);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const c=await pg.evaluate(grab);
  const byKind={};
  a.forEach((x,i)=>{ const k=x.kind; byKind[k]=byKind[k]||{total:0,resized:0,samples:[]};
    byKind[k].total++;
    if(Math.abs(c[i].h-x.h)>1e-6){ byKind[k].resized++;
      if(byKind[k].samples.length<3) byKind[k].samples.push(x.s+': '+x.h+' -> '+c[i].h); } });
  console.log(dxf, JSON.stringify(byKind,null,1));
  await b.close();
 }
})();
