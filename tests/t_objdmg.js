const {open,loadDxf}=require('./harness');
// Which non-annotation lines does STYLIZE alter? Object geometry must be untouched.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  const grab=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[]; (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._dim||p._section) return;
      out.push({layer:p._layer, key:JSON.stringify(p.pts), sec:p._sec||null, ansi:!!p._ansi}); }));
    return out; };
  const a=await pg.evaluate(grab);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const c=await pg.evaluate(grab);
  const m=new Map(); a.forEach(x=>m.set(x.key,(m.get(x.key)||0)+1));
  const changed=c.filter(x=>!m.get(x.key));
  const gone=[]; const m2=new Map(); c.forEach(x=>m2.set(x.key,(m2.get(x.key)||0)+1));
  a.forEach(x=>{ if(!m2.get(x.key)) gone.push(x); });
  console.log('changed after stylize:', changed.length);
  console.log(JSON.stringify(changed.slice(0,6).map(x=>({layer:x.layer,sec:x.sec,ansi:x.ansi,pts:x.key.slice(0,60)})),null,1));
  console.log('vanished:', gone.length, JSON.stringify(gone.slice(0,3).map(x=>({layer:x.layer,pts:x.key.slice(0,60)}))));
  await b.close();
})();
