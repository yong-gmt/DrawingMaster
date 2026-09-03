const {open,loadDxf}=require('./harness');
const SNAP=()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  const S=[]; (P.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>S.push([p._sec||'',JSON.stringify(p.pts),JSON.stringify(p._arrow||0)].join('|')));
    (o.prims.texts||[]).forEach(t=>S.push(['T',t._sec||'',t.x,t.y,t.rot,t.h,t.text].join('|')));
    (o.prims.solids||[]).forEach(s=>S.push(['S',s._sec||'',JSON.stringify(s)].join('|')));
  });
  const m=new Map(); S.forEach(k=>m.set(k,(m.get(k)||0)+1)); return [...m.entries()].sort().map(String).join(';');
};
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  // Import no longer redraws anything - that is STYLIZE's job now - so press it
  // before asking what the drawing is made of.
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const before=(P.dxf.secs||[]).map(s=>s.ends.map(e=>e.view.map(v=>Math.round(v))));
    // grouping: are the cut line and BOTH letters in one selectable group?
    const groups=(P.dxf.secs||[]).map(s=>{
      const objs=(P.objects||[]).filter(o=>o._sec===s.id);
      const g=new Set(objs.map(o=>o.group));
      const letters=objs.filter(o=>(o.prims.texts||[]).some(t=>t._sec===s.id)).length;
      // click the cut line and see what comes with it
      const line=objs.find(o=>(o.prims.polys||[]).some(p=>p._sec===s.id));
      h.setSelection([line.id]);
      const sel=[...h.selIds].map(i=>h.objById(i));
      return {id:s.id, objs:objs.length, groups:g.size, letters,
        selectedWithLine:sel.length,
        lettersInSelection:sel.filter(o=>(o.prims.texts||[]).some(t=>t._sec===s.id)).length};
    });
    return {before, groups};
  });
  const s0=await pg.evaluate(SNAP);
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const s1=await pg.evaluate(SNAP);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const s2=await pg.evaluate(SNAP);
  const after=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
    return (P.dxf.secs||[]).map(s=>{
      const objs=(P.objects||[]).filter(o=>o._sec===s.id);
      let poly=null, drawn=0, solids=0;
      objs.forEach(o=>{ (o.prims.polys||[]).forEach(p=>{ if(p._sec!==s.id) return;
          if(p.pts.length>=2){ drawn++; poly={o,p}; } });
        (o.prims.solids||[]).forEach(sd=>{ if(sd._sec===s.id) solids++; }); });
      if(!poly) return {id:s.id, drawnPolys:drawn, looseSolids:solids};
      const A=poly.p.pts.map(q=>[q[0]+(poly.o.dx||0), q[1]+(poly.o.dy||0)]);
      const dir0=[A[0][0]-A[1][0], A[0][1]-A[1][1]];
      const dirN=[A[A.length-1][0]-A[A.length-2][0], A[A.length-1][1]-A[A.length-2][1]];
      const nrm=(v)=>{const L=Math.hypot(v[0],v[1])||1; return [Math.round(v[0]/L),Math.round(v[1]/L)];};
      return {id:s.id, drawnPolys:drawn, looseSolids:solids, points:A.length,
        hasArrowCaps:!!(poly.p._arrow&&poly.p._arrow.s&&poly.p._arrow.e),
        arrowDirs:[nrm(dir0), nrm(dirN)]};
    });
  });
  console.log('grouping   ', JSON.stringify(r.groups));
  console.log('viewFromFile', JSON.stringify(r.before));
  console.log('afterStylize', JSON.stringify(after));
  console.log('stylizeChangedSomething', s0!==s1, ' pressAgainDrift', s1!==s2);
  await b.close();
})();
