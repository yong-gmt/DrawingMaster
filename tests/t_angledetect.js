const {open,loadDxf}=require('./harness');
// Angular dimensions drawn every way a program might draw them - vertex inside or
// outside the measured segments, sweeps both ways, reflex, tiny, near-straight.
// The one real sample is a single 22 degree angle drawn one particular way, and a
// rule that only works on it is not a rule.
const WANT=[
  ['right angle',   90], ['acute',        35], ['obtuse',        140],
  ['very small',     7], ['near straight',175], ['reflex',       240],
  ['clockwise sweep',65], ['vertex outside',40], ['mixed ends',    50],
];
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await loadDxf(pg,'angles.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1500);
  const got=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.dims||[]).filter(m=>m.kind==='angular').map(m=>{
      let txt=null;
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(t._dim===m.id) txt=String(t.text); }));
      return {deg:+(Math.abs(m.sweep)*180/Math.PI).toFixed(2), ok:m.ok, value:txt};
    });
  });
  console.log('angular dimensions found:', got.length, 'of', WANT.length);
  const pool=got.slice(); const missed=[];
  WANT.forEach(([label,deg])=>{
    const i=pool.findIndex(g=>Math.abs(g.deg-deg)<0.5 ||
                              Math.abs(g.deg-(360-deg))<0.5);
    if(i<0) missed.push(label+' ('+deg+'\u00b0)');
    else {
      const g=pool.splice(i,1)[0];
      const exact=Math.abs(g.deg-deg)<0.5;
      console.log('  '+(label+'              ').slice(0,16),
        'read as', String(g.deg)+'\u00b0', exact? '' : '  <-- the other way round',
        '| value', JSON.stringify(g.value));
    }
  });
  console.log('not detected:', missed.length, missed);
  console.log('every value carries a degree sign:',
    got.every(g=>g.value && /\u00b0$/.test(g.value)));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
