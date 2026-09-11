const {open,loadDxf}=require('./harness');
// An angular dimension must be draggable like every other kind: pull the arc out
// and it follows; slide the value round the arc and it follows. The ANGLE never
// changes, because two lines fix it - dragging must not alter what it measures.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1400);

  const drag=(kind, dx, dy)=>pg.evaluate(({kind,dx,dy})=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.kind==='angular');
    h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
    const g=h.dimModelGrips(P).find(x=>x.kind===kind);
    if(!g) return {no:'grip '+kind};
    const before={radius:+m.radius.toFixed(3),
                  degrees:+(Math.abs(m.sweep)*180/Math.PI).toFixed(3),
                  text:(()=>{const q=h.dimGeomOf(m).text; return [+q.x.toFixed(2), +q.y.toFixed(2)];})()};
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(g.at[0], g.at[1]);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    ev('mousedown',A.x,A.y); ev('mousemove',A.x+dx,A.y+dy);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    const after={radius:+m.radius.toFixed(3),
                 degrees:+(Math.abs(m.sweep)*180/Math.PI).toFixed(3),
                 text:(()=>{const q=h.dimGeomOf(m).text; return [+q.x.toFixed(2), +q.y.toFixed(2)];})()};
    return {before, after};
  }, {kind,dx,dy});

  const a=await drag('angarc', 60, -60);
  console.log('dragging the arc  : radius', a.before.radius, '->', a.after.radius,
              '| angle', a.before.degrees, '->', a.after.degrees);
  console.log('   the arc moved:', Math.abs(a.after.radius-a.before.radius)>1,
              '· the angle held:', a.before.degrees===a.after.degrees);

  /* The value must end up UNDER THE CURSOR, in every direction. Keeping it to a
     fraction of the sweep let it move a little and then stop - on a 22 degree
     angle that is a few millimetres, so it looked stuck. */
  for(const [dx,dy] of [[0,-140],[160,0],[-200,90],[60,120]]){
    const r=await pg.evaluate(({dx,dy})=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=(P.dxf.dims||[]).find(x=>x.kind==='angular');
      h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
      const g=h.dimModelGrips(P).find(x=>x.kind==='angtext');
      const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
      const A=h.W2S(g.at[0], g.at[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',A.x+dx,A.y+dy);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const g2=h.dimGeomOf(m);
      /* S2W hands back {x,y}, not a pair - reading it as an array gave NaN and
         made a working drag look like a broken one. */
      const want=h.S2W(A.x+dx, A.y+dy);
      return {off:+Math.hypot(g2.text.x-want.x, g2.text.y-want.y).toFixed(2),
              deg:+(Math.abs(m.sweep)*180/Math.PI).toFixed(2)};
    }, {dx,dy});
    console.log('  dragged '+(dx+','+dy).padStart(9)+' -> the value sits',
      r.off, 'mm from the cursor · angle', r.deg+'\u00b0');
  }
  /* Dragging the value home must snap it to the middle, restore the standard
     clear space, and TAKE BACK the stubs the arc had run out to - a stroke left
     behind belongs to a shape that no longer exists. */
  const home=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.kind==='angular');
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const look=()=>{ let stub=0;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id || !(p.pts||[]).length) return;
        if(/^arcOut/.test(p._role||'')) stub++; }));
      const g=h.dimGeomOf(m);
      return {stubs:stub, arrowsOnTheArc:!!(g.segs[0].arrow),
        gapMM:+(Math.hypot(g.text.x-m.centre[0], g.text.y-m.centre[1])-m.radius).toFixed(2),
        offCentreMM:(()=>{ const a=m.a0+m.sweep/2, R=Math.hypot(g.text.x-m.centre[0],g.text.y-m.centre[1]);
          const q=[m.centre[0]+R*Math.cos(a), m.centre[1]+R*Math.sin(a)];
          return +Math.hypot(g.text.x-q[0], g.text.y-q[1]).toFixed(2); })()};
    };
    const go=(to)=>{ h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
      const g=h.dimModelGrips(P).find(x=>x.kind==='angtext');
      const A=h.W2S(g.at[0],g.at[1]), B=h.W2S(to[0],to[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
    const C=m.centre, r=m.radius, gap=4/h.mm2px(1);
    go([C[0]+(r+40)*Math.cos(m.a0-0.9), C[1]+(r+40)*Math.sin(m.a0-0.9)]);
    const away=look();
    const a=m.a0+m.sweep/2, R=r+(m.text.h||2.5)*0.5+gap;
    go([C[0]+R*Math.cos(a), C[1]+R*Math.sin(a)]);
    return {away, back:look(), wantedGap:+gap.toFixed(2)};
  });
  /* The value rides the ARC: dragging moves it round the curve, and it keeps the
     same clear space from the line wherever it goes. There is no elbow and no
     horizontal shelf - the arc simply carries on. */
  const ride=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.kind==='angular');
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const C=m.centre;
    const go=(to)=>{ h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
      const g=h.dimModelGrips(P).find(x=>x.kind==='angtext');
      const A=h.W2S(g.at[0],g.at[1]), B=h.W2S(to[0],to[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
    /* Does the arc run out far enough to be UNDER the value? Ask whether the
       value's angle falls inside the angles the arc covers - looking for a sampled
       point near it failed on nothing worse than the sampling step. */
    const reaches=()=>{
      const g=h.dimGeomOf(m), ta=m.text.ta;
      if(ta==null) return true;
      let lo=Infinity, hi=-Infinity;
      g.segs.forEach(s=>{ if(!/^arc/.test(s.role)) return;
        (s.pts||[]).forEach(q=>{ const a=Math.atan2(q[1]-C[1], q[0]-C[0]);
          lo=Math.min(lo,a); hi=Math.max(hi,a); }); });
      return ta>=lo-1e-6 && ta<=hi+1e-6;
    };
    const gaps=[], shapes=[], covered=[];
    [0.5, -0.6, 1.4].forEach(k=>{
      const a=m.a0+m.sweep*k, R=m.radius+60;      /* far out, and round the arc */
      go([C[0]+R*Math.cos(a), C[1]+R*Math.sin(a)]);
      const g=h.dimGeomOf(m);
      gaps.push(+(Math.hypot(g.text.x-C[0], g.text.y-C[1])-m.radius).toFixed(3));
      shapes.push(g.segs.map(s=>s.role).join('+'));
      covered.push(reaches());
    });
    return {gaps, shapes, covered};
  });
  console.log('dragged round the arc, the value sits', JSON.stringify(ride.gaps), 'mm off it');
  console.log('  the same clear space every time:',
    Math.max(...ride.gaps)-Math.min(...ride.gaps)<0.01);
  console.log('  no elbow and no shelf, just the arc:',
    ride.shapes.every(s=>!/angLead|angLand/.test(s)));
  console.log('  the arc runs out under the value every time:',
    ride.covered.every(Boolean));
  /* A value dragged just past ONE end must lengthen the arc at THAT end. Turned so
     the arc straddles the +-180 degree seam, the old code read a value just past
     the far end as most of a turn past the near one, and ran the arc round from
     there to meet it - a closed circle instead of a short run-out. Every stroke is
     summed as drawn. Last, because it turns the model to get there. */
  const seam=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).find(x=>x.kind==='angular');
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const C=m.centre, out=[];
    for(const a0 of [150, 170, -170]) for(const k of [1.4, -0.4]){
      m.a0=a0*Math.PI/180; m.text.ta=null; m.text.tr=null;
      h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
      const g=h.dimModelGrips(P).find(x=>x.kind==='angtext');
      const a=m.a0+m.sweep*k, R=m.radius+8;
      const A=h.W2S(g.at[0],g.at[1]), B=h.W2S(C[0]+R*Math.cos(a), C[1]+R*Math.sin(a));
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const len={};
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id || !/^arc/.test(p._role||'') || !(p.pts||[]).length) return;
        let s=0; for(let i=1;i<p.pts.length;i++){
          const u=Math.atan2(p.pts[i-1][1]+(o.dy||0)-C[1], p.pts[i-1][0]+(o.dx||0)-C[0]);
          const v=Math.atan2(p.pts[i][1]+(o.dy||0)-C[1],   p.pts[i][0]+(o.dx||0)-C[0]);
          s+=Math.abs(Math.atan2(Math.sin(v-u), Math.cos(v-u))); }
        len[p._role]=s*180/Math.PI; }));
      const total=Object.values(len).reduce((x,y)=>x+y,0);
      const grew=(k>1)? 'arcOut1' : 'arcOut0', other=(k>1)? 'arcOut0' : 'arcOut1';
      out.push({a0, k, totalDeg:+total.toFixed(1),
                rightEndGrew:(len[grew]||0) > (len[other]||0)});
    }
    return out;
  });
  console.log('arc across the seam, value dragged past one end:',
    seam.map(s=>s.a0+'/'+s.k+' -> '+s.totalDeg+'°').join(' · '));
  console.log('  never a closed circle:', seam.every(s=>s.totalDeg<300),
              '· the end it was dragged past is the end that grew:', seam.every(s=>s.rightEndGrew));
  console.log('value dragged away :', JSON.stringify(home.away));
  console.log('value dragged home :', JSON.stringify(home.back));
  console.log('  snapped to the middle:', home.back.offCentreMM<0.05,
              '· clear space kept:', Math.abs(home.back.gapMM-(home.wantedGap+1.76))<0.5 || home.back.gapMM>0,
              '· the stubs were taken back:', home.back.stubs===0,
              '· arrowheads back on the arc:', home.back.arrowsOnTheArc);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
