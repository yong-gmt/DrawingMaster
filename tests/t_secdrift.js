const {open,loadDxf}=require('./harness');
const SNAP=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  const S=[]; (P.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>S.push('P|'+(p._sec||p._dim||'')+'|'+JSON.stringify(p.pts)+'|'+JSON.stringify(p._arrow||0)));
    (o.prims.texts||[]).forEach(t=>S.push('T|'+(t._sec||t._dim||'')+'|'+[t.x.toFixed(4),t.y.toFixed(4),t.rot,t.h,t.text].join(',')));
    (o.prims.solids||[]).forEach(s=>S.push('S|'+(s._sec||s._dim||'')+'|'+JSON.stringify(s)));
  });
  return S;
};
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const a=await pg.evaluate(SNAP);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const c=await pg.evaluate(SNAP);
  const m=new Map(); a.forEach(k=>m.set(k,(m.get(k)||0)+1));
  const extra=[]; c.forEach(k=>{ const n=m.get(k)||0; if(n) m.set(k,n-1); else extra.push(k); });
  const missing=[]; m.forEach((n,k)=>{ for(let i=0;i<n;i++) missing.push(k); });
  console.log('added', extra.length, 'removed', missing.length);
  console.log('sample added  ', extra.slice(0,4));
  console.log('sample removed', missing.slice(0,4));
  await b.close();
})();
