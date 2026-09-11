const {open,loadDxf}=require('./harness');
// Every arrowhead on a sheet must be ONE size after STYLIZE, and that size is
// decided by the PAPER: A4 2.5 · A3 2.5 · A2 3.5 mm, three times as long as wide.
// It used to be measured from the file's own heads, so a drawing made on A4
// arrived with 1.25 mm heads and one made on A3 with 2.5 mm - and a single sheet
// could carry both, because Sheet3 drew its dimensions at 2.5 mm and its section
// markers at 3.5. Read from the arrowheads the page DRAWS, not from the models.
// Rule 3 still holds: an import shows the file, so the sizes before STYLIZE are
// whatever the author drew, and only the button makes them agree.
const WANT={A4:2.5, A3:2.5, A2:3.5};
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await loadDxf(pg,dxf);
  /* what the file itself drew: real arrowhead triangles, tip to the middle of
     the opposite side - the way the model measures one */
  const before=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const head=(sd)=>{
      const p=[]; (sd||[]).forEach(q=>{ if(!p.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<1e-6)) p.push(q); });
      if(p.length<3) return null;
      let best=null;
      for(let i=0;i<3;i++){ const a=p[(i+1)%3], b=p[(i+2)%3];
        const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        const len=Math.hypot(p[i][0]-mid[0], p[i][1]-mid[1]);
        if(!best||len>best) best=len; }
      return best;
    };
    const sizes=[];
    (P.objects||[]).forEach(o=>(o.prims.solids||[]).forEach(sd=>{
      const L=head(sd); if(L && L>0.3 && L<12) sizes.push(+L.toFixed(2)); }));
    return [...new Set(sizes)].sort((x,y)=>x-y);
  });
  console.log(dxf, '| the file drew heads at', JSON.stringify(before), 'mm');

  /* every paper size the app offers, each one restyled and then measured */
  for(const paper of ['A4','A3','A2']){
    await pg.evaluate((p)=>{ window.__hook().store.format.paper=p; }, paper);
    await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    await pg.waitForTimeout(1400);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const lens=[], wids=[], where={};
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(!p._arrow || !(p.pts||[]).length) return;
        const L=+(p._arrow.h||0).toFixed(2);
        lens.push(L); wids.push(+(p._arrow.w||0).toFixed(2));
        const kind=p._sec? 'section' : 'dimension';
        (where[kind]=where[kind]||new Set()).add(L); }));
      const uniq=a=>[...new Set(a)].sort((x,y)=>x-y);
      return {heads:lens.length, sizes:uniq(lens),
              byPart:Object.fromEntries(Object.entries(where).map(([k,v])=>[k,[...v].sort()])),
              ratio:uniq(lens.map((L,i)=>+(L/(wids[i]||1)).toFixed(2)))};
    });
    console.log('  '+paper+':', r.heads, 'heads ·', JSON.stringify(r.sizes), 'mm ·',
      'dimensions', JSON.stringify(r.byPart.dimension||[]),
      '· section markers', JSON.stringify(r.byPart.section||[]));
    console.log('     one size on the sheet:', r.sizes.length===1,
      '· the size this paper asks for ('+WANT[paper]+'):',
        r.sizes.length===1 && Math.abs(r.sizes[0]-WANT[paper])<0.01,
      '· 3:1:', r.ratio.every(x=>Math.abs(x-3)<0.05));
  }
  console.log('  errors:', errs.length, errs.slice(0,2));
  await b.close();
 }
})();
