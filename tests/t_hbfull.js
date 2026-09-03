const {open,loadDxf}=require('./harness');
// The whole pipeline on a drawing from a different CAD program.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await loadDxf(pg,'Head-back.dxf');
  const snap=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[]; (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>S.push('P|'+JSON.stringify(p.pts)+'|'+JSON.stringify(p._arrow||0)));
      (o.prims.texts||[]).forEach(t=>S.push('T|'+[t.x.toFixed(4),t.y.toFixed(4),t.h,t.rot,t.text].join(',')));
      (o.prims.solids||[]).forEach(s=>S.push('S|'+JSON.stringify(s))); });
    return S; };
  const objLines=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[]; (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._dim||p._section||p._sec) return; S.push(JSON.stringify(p.pts)); })); return S; };
  const o0=await pg.evaluate(objLines);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const s1=await pg.evaluate(snap);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const s2=await pg.evaluate(snap);
  const o1=await pg.evaluate(objLines);
  const diff=(a,c)=>{ const m=new Map(); a.forEach(k=>m.set(k,(m.get(k)||0)+1));
    let n=0; c.forEach(k=>{ const v=m.get(k)||0; if(v) m.set(k,v-1); else n++; });
    m.forEach(v=>n+=v); return n; };
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const D=(P.dxf.dims||[]).filter(m=>m.ok);
    const rad=D.filter(m=>m.kind==='radial'||m.kind==='diameter');
    const lin=D.filter(m=>m.dir);
    const PXMM=96/25.4, cc=document.createElement('canvas').getContext('2d');
    cc.font='100px '+h.store.format.font+',Arial';
    const gaps=[];
    lin.forEach(m=>{ const g=h.dimGeomOf(m), u=m.dir, n=[-u[1],u[0]];
      const mt=cc.measureText(String(g.text.str));
      const w=mt.width*m.text.h/100, asc=mt.actualBoundingBoxAscent*m.text.h/100,
            desc=Math.max(0,mt.actualBoundingBoxDescent)*m.text.h/100;
      const rr=(g.text.rot||0)*Math.PI/180;
      const R=[Math.cos(rr),Math.sin(rr)], U=[-Math.sin(rr),Math.cos(rr)];
      const qs=[[-w/2,-desc],[w/2,-desc],[-w/2,asc],[w/2,asc]].map(([a,b2])=>
        (g.text.x+R[0]*a+U[0]*b2)*n[0]+(g.text.y+R[1]*a+U[1]*b2)*n[1]);
      gaps.push(+((Math.min(...qs.map(v=>Math.abs(v-m.line.q))))*PXMM).toFixed(2)); });
    return { dims:D.length, linear:lin.length, radialOrDia:rad.length,
      sections:(P.dxf.secs||[]).length,
      valueGapPx:[Math.min(...gaps), Math.max(...gaps)],
      radialArrowOffArcMM:+Math.max(0,...rad.map(m=>{ const g=h.dimGeomOf(m);
        return Math.abs(Math.hypot(g.segs[0].b[0]-m.centre[0], g.segs[0].b[1]-m.centre[1])-m.radius); })).toFixed(5),
      radialCentreMarks:rad.filter(m=>h.dimGeomOf(m).centreAt).length };
  });
  console.log(JSON.stringify({...r, objectLinesChanged:diff(o0,o1),
    pressStylizeAgainDrift:diff(s1,s2), errors:errs.length}, null, 1));
  await b.close();
})();
