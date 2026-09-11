const {open,loadDxf}=require('./harness');
// An angular dimension states an angle. It must read the angle the file states,
// draw an arc that reaches both measured lines, carry a degree sign, and put the
// value on the middle of its arc rather than off to one side.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1400);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.kind==='angular').forEach(m=>{
      const g=h.dimGeomOf(m);
      let txt=null, arc=null, ext=0, leftovers=0;
      (P.objects||[]).forEach(o=>{
        const dx=o.dx||0, dy=o.dy||0;
        (o.prims.polys||[]).forEach(p=>{
          if(p._dim!==m.id) return;
          if(p._role==='arc') arc=(p.pts||[]).map(q=>[q[0]+dx,q[1]+dy]);
          if(/^ext/.test(p._role||'') && (p.pts||[]).length) ext++;
          /* A stroke with no role of ours is one the FILE drew. After STYLIZE has
             taken the dimension over there must be none left, or the drawing
             carries the old arc underneath the new one. */
          if(!p._role && (p.pts||[]).length) leftovers++;
        });
        (o.prims.texts||[]).forEach(t=>{ if(t._dim===m.id)
          txt={s:String(t.text), at:[t.x+dx, t.y+dy], h:+t.h.toFixed(2), rot:t.rot||0}; });
      });
      const C=m.centre, r0=m.radius;
      // every point of the arc must sit on the radius the file gave
      let worst=0;
      (arc||[]).forEach(q=>{ worst=Math.max(worst, Math.abs(Math.hypot(q[0]-C[0],q[1]-C[1])-r0)); });
      // the value belongs on the middle of the arc
      const am=m.a0+m.sweep/2;
      const mid=[C[0]+r0*Math.cos(am), C[1]+r0*Math.sin(am)];
      const offMiddle=txt? Math.hypot(txt.at[0]-mid[0], txt.at[1]-mid[1]) : null;
      /* When the value cannot fit between the two arrowheads, a drawing puts them
         OUTSIDE, pointing back in at the ends they mark, and runs the arc on past
         them. Check the form as well as the numbers. */
      const stubs=g.segs.filter(x=>/^arcOut/.test(x.role));
      const capsOnStubs=stubs.length===2 && stubs.every(x=>x.arrow && x.arrow.s);
      const capsOnArc=!!(g.segs[0].arrow && (g.segs[0].arrow.s||g.segs[0].arrow.e));
      const room=Math.abs(m.sweep)*m.radius;
      const need=h.dimTextWidth(txt? txt.s : '', m.text.h)+ (m.line.arrow||2.5)*2;
      /* The value leans with the arc - square to the radius where it sits - with
         its BASE towards the arc. Read off the drawn text, not the model: folding
         it "upright" turned it over half way round, so its top faced the arc and
         the baseline-anchored number sank onto its own line. */
      const textA=(m.text.ta==null)? (m.a0+m.sweep/2) : m.text.ta;
      let tan=(textA-Math.PI/2); tan=Math.atan2(Math.sin(tan), Math.cos(tan))*180/Math.PI;
      const rr=(txt? txt.rot : 0)*Math.PI/180, up=[-Math.sin(rr), Math.cos(rr)];
      const d=txt? Math.hypot(txt.at[0]-C[0], txt.at[1]-C[1]) : 1;
      const outw=txt? [(txt.at[0]-C[0])/d, (txt.at[1]-C[1])/d] : [0,0];
      out.push({
        textLeanDeg: +(txt? txt.rot : NaN).toFixed(2),
        tangentThereDeg: +tan.toFixed(2),
        baseFacesArc: (up[0]*outw[0]+up[1]*outw[1]) > 0.999,
        arrowsOutside: stubs.length===2,
        arrowsPointBackIn: capsOnStubs && !capsOnArc,
        theValueWouldNotFitInside: room<need,
        degrees:+(Math.abs(m.sweep)*180/Math.PI).toFixed(2),
        value:txt&&txt.s,
        hasDegreeSign: !!(txt && /\u00b0$/.test(txt.s)),
        arcOffRadiusMM:+worst.toFixed(4),
        extensionLines:ext,
        theFilesOwnStrokesLeftBehind:leftovers,
        arrowheads:(arc? 2:0),
        valueOffTheArcMiddleMM:offMiddle==null? null : +offMiddle.toFixed(2)
      });
    });
    return out;
  });
  /* The clear space between a value and its line is the same on every kind of
     dimension - a drawing with three different gaps reads as three drawings. */
  const gaps=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const PX=h.mm2px(1), pick=(k)=>(P.dxf.dims||[]).find(x=>x.kind===k && x.ok);
    const A=pick('angular'), R=pick('radial'), L=pick('linear');
    /* The angular value's clear space, from the DRAWN text: its baseline faces the
       arc, so the gap is baseline-to-arc less whatever ink dips under the baseline,
       at the print density every dimension's gap is set in. */
    let T=null;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._dim===A.id) T={x:t.x+(o.dx||0), y:t.y+(o.dy||0), h:t.h, s:String(t.text)}; }));
    const c=document.createElement('canvas').getContext('2d');
    c.font='100px '+(h.store.format.font||'Arial')+',Arial';
    const desc=T.h*Math.max(0, c.measureText(T.s).actualBoundingBoxDescent)/100;
    return {angular:+((Math.hypot(T.x-A.centre[0], T.y-A.centre[1]) - A.radius - desc)*96/25.4).toFixed(2),
            radial:+(h.dimGeomOf(R).text.gapPx||4),
            linear:+(h.dimGeomOf(L).text.gapPx||4)};
  });
  console.log('clear space from the line, in px: angular', gaps.angular,
              '· radial', gaps.radial, '· linear', gaps.linear,
              '->', (gaps.angular===gaps.radial && gaps.radial===gaps.linear)? 'the same' : 'DIFFERENT');
  r.forEach(x=>{
    console.log('angle stated', x.degrees+'\u00b0 · drawn as', JSON.stringify(x.value));
    console.log('  degree sign:', x.hasDegreeSign,
                '· arc off its radius:', x.arcOffRadiusMM, 'mm',
                '· extension lines:', x.extensionLines,
                '· the file’s old strokes left behind:', x.theFilesOwnStrokesLeftBehind);
    console.log('  the value leans', x.textLeanDeg+'\u00b0 · the arc there runs at',
                x.tangentThereDeg+'\u00b0 ->',
                Math.abs(x.textLeanDeg-x.tangentThereDeg)<0.01? 'it follows the arc' : 'IT DOES NOT FOLLOW',
                '· its base faces the arc:', x.baseFacesArc);
    console.log('  the value would not fit between the arrows:', x.theValueWouldNotFitInside,
                '-> arrows outside:', x.arrowsOutside,
                '· pointing back in:', x.arrowsPointBackIn);
  });
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
