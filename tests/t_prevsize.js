const {open,loadDxf}=require('./harness');
// Both previews claim to show the configured text height. Measure the actual ink
// each one produces and compare with the height the sheet really uses.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const f=h.store.format;
    // what the sheet actually draws a dimension value at
    let onSheet=null;
    (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._dim && onSheet==null) onSheet=t.h; }));
    document.querySelector('#btnFormat').click();
    return {configPt:f.fontSize, configMM:+(f.fontSize*(25.4/72)).toFixed(3),
            onSheetMM:onSheet};
  });
  await pg.waitForTimeout(600);
  const m=await pg.evaluate(()=>{
    const f=window.__hook().store.format;
    // typography preview: measure the real cap height of its ink, in CSS px,
    // then convert with the panel's own mm-per-px so it can be compared
    // both previews are canvases now: rebuild each one's font the way it does and
    // measure the ink it produces, then convert with its own scale
    const tp=document.querySelector('#typoPrev');
    const tw=tp.clientWidth, th0=tp.clientHeight;
    const pxT=(()=>{ let px=(tw-24)/60;
      const need=()=>(f.fontSize||10)*(25.4/72)*px + (4/(96/25.4))*px + (f.stroke||0.2)*px + 10;
      if(need()>th0*0.92) px*=th0*0.92/need(); return px; })();
    const c=document.createElement('canvas').getContext('2d');
    c.font=((f.fontSize||10)*(25.4/72)*pxT)+'px '+f.font+',Arial';
    const asc=c.measureText('60.00').actualBoundingBoxAscent;
    // stroke preview: same measurement from its own canvas settings
    const sp=document.querySelector('#strokePrev');
    const spCss=sp.clientWidth, spH=sp.clientHeight;
    const spanMM=60;
    let px=(spCss-24)/spanMM;
    const need=()=>(f.fontSize||10)*(25.4/72)*px + (4/(96/25.4))*px + (f.stroke||0.2)*px + 10;
    if(need()>spH*0.92) px*=spH*0.92/need();
    const th=(f.fontSize||10)*(25.4/72)*px;
    const c2=document.createElement('canvas').getContext('2d');
    c2.font=th+'px '+f.font+',Arial';
    const asc2=c2.measureText('60.00').actualBoundingBoxAscent;
    return {typoCapMM:+(asc/pxT).toFixed(3), strokeCapMM:+(asc2/px).toFixed(3),
            typoPxPerMM:+pxT.toFixed(3), strokePxPerMM:+px.toFixed(3)};
  });
  console.log(JSON.stringify({...r, ...m}, null, 1));
  console.log('cap height shown by each preview, in mm:',
    'typography', m.typoCapMM, '| stroke', m.strokeCapMM,
    '| agree:', Math.abs(m.typoCapMM-m.strokeCapMM)<0.01);
  await b.close();
})();
