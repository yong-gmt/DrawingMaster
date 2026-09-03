const {open,loadDxf}=require('./harness');

const CHECK = () => {
  // measure every modelled dimension: do extension lines actually reach the
  // dimension line, and does each drawn end carry its arrowhead?
  const h=window.__hook(); const pg=h.activePage();
  const out=[];
  (h.dimModels(pg)||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
    const u=m.dir, n=[-u[1],u[0]], D=(p,v)=>p[0]*v[0]+p[1]*v[1];
    const prims={};
    (pg.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>{ if(p._dim===m.id&&p._role) prims[p._role]={p,o}; });
      (o.prims.texts||[]).forEach(t=>{ if(t._dim===m.id&&t._role==='val') prims.val={t,o}; });
    });
    const q=m.line.q;
    let extGap=0, extN=0;
    ['ext0','ext1'].forEach(r=>{ const e=prims[r]; if(!e||e.p.pts.length<2) return;
      extN++;
      const qs=e.p.pts.map(pt=>D([pt[0]+(e.o.dx||0), pt[1]+(e.o.dy||0)],n));
      const lo=Math.min(...qs), hi=Math.max(...qs);
      const miss=(q<lo)? lo-q : (q>hi)? q-hi : 0;      // 0 = it spans the line
      extGap=Math.max(extGap, miss);
    });
    // an arrowhead is expected on the piece that terminates at an extension line
    const g=h.dimGeomOf(m);
    let arrows=0, drawn=0;
    g.segs.forEach(sg=>{ if(sg.hidden||!sg.arrow) return;
      const e=prims[sg.role]; drawn++;
      if(e&&e.p._arrow&&(e.p._arrow.s||e.p._arrow.e)) arrows++; });
    out.push({id:m.id, extGap:+extGap.toFixed(4), extN, drawn, arrows,
              val:prims.val? String(prims.val.t.text):null,
              q:+m.line.q.toFixed(4)});
  });
  return out;
};

async function dragEach(pg, page, dyMM){
  return await page.evaluate(async (dy)=>{
    const h=window.__hook(); const P=h.activePage();
    const models=(h.dimModels(P)||[]).filter(m=>m.ok&&m.dir);
    const st=document.getElementById('stage')||document.querySelector('#stage');
    const r=st.getBoundingClientRect();
    let done=0, fail=[];
    for(const m of models){
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      if(!ids.length){ fail.push([m.id,'no objects']); continue; }
      h.setSelection(ids);
      const g=h.dimGeomOf(m);
      // grab the longest drawn piece: on a tight dimension the inside piece is a stub
      let seg=null,bl=-1;
      g.segs.forEach(s=>{ if(s.hidden||!s.a) return;
        const L=Math.hypot(s.b[0]-s.a[0], s.b[1]-s.a[1]); if(L>bl){bl=L;seg=s;} });
      if(!seg){ fail.push([m.id,'no seg']); continue; }
      // Grab the LINE GRIP. Only the grip squares reshape a dimension now - the
      // rest of it is free for dragging the whole thing - so a test that grabs a
      // bare point on the line is asking for the wrong thing.
      const lg=h.dimModelGrips(P).filter(x=>x.kind==='line');
      if(!lg.length){ fail.push([m.id,'no line grip']); continue; }
      const mid=lg[0].at.slice();
      const s0=h.W2S(mid[0],mid[1]);
      const n=[-m.dir[1],m.dir[0]];
      const s1=h.W2S(mid[0]+n[0]*dy, mid[1]+n[1]*dy);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+x,clientY:r.top+y,button:0}));
      const q0=m.line.q;
      ev('mousedown',s0.x,s0.y); ev('mousemove',(s0.x+s1.x)/2,(s0.y+s1.y)/2);
      ev('mousemove',s1.x,s1.y); window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      if(Math.abs(m.line.q-q0)<1e-6) fail.push([m.id,'no move']); else done++;
    }
    return {done, total:models.length, fail:fail.slice(0,5)};
  }, dyMM);
}

(async()=>{
  for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,dxf);
    const before=await pg.evaluate(CHECK);
    const res=await dragEach(null,pg,6);
    const after=await pg.evaluate(CHECK);
    const worstB=Math.max(0,...before.map(x=>x.extGap));
    const worstA=Math.max(0,...after.map(x=>x.extGap));
    const badA=after.filter(x=>x.extGap>0.001).length;
    const noArrow=after.filter(x=>x.arrows<x.drawn).length;
    const valChanged=after.filter((x,i)=>x.val!==before[i].val).length;
    console.log(dxf, JSON.stringify({drag:res, extGapBefore:+worstB.toFixed(3),
      extGapAfter:+worstA.toFixed(3), dimsWithGap:badA+'/'+after.length,
      segsMissingArrow:noArrow, valueChanged:valChanged}));
    await b.close();
  }
})();
