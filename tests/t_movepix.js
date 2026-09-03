const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
// Does the drawing actually MOVE on screen when you drag it? Real mouse, and the
// answer read off the pixels - not from which object id I guessed at.
const diff=async(a,b)=>{
  const A=await sharp(a).raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).raw().toBuffer({resolveWithObject:true});
  let n=0; const {width,height,channels}=A.info;
  for(let i=0;i<width*height;i++){
    let d=0; for(let c=0;c<3;c++) d=Math.max(d, Math.abs(A.data[i*channels+c]-B.data[i*channels+c]));
    if(d>60) n++; }
  return n;
};
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(800);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(1600);

  const cases=[
    ['a plain line', ()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const o=(P.objects||[]).find(x=>!x._dim&&!x._sec&&!x._bal&&(x.prims.polys||[]).some(q=>q.pts.length>=2));
      const pl=o.prims.polys.find(q=>q.pts.length>=2);
      return [(pl.pts[0][0]+pl.pts[1][0])/2+(o.dx||0), (pl.pts[0][1]+pl.pts[1][1])/2+(o.dy||0)];
    }],
    ['a whole dimension', ()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=(P.dxf.dims||[]).find(x=>x.ok&&x.dir);
      h.setSelection((P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id));
      const g=h.dimGeomOf(m), seg=g.segs.find(s=>!s.hidden&&s.a);
      const grips=h.dimModelGrips(P);
      for(let f=0.05; f<=0.95; f+=0.05){
        const q=[seg.a[0]+(seg.b[0]-seg.a[0])*f, seg.a[1]+(seg.b[1]-seg.a[1])*f];
        if(grips.every(gr=>Math.hypot(gr.at[0]-q[0], gr.at[1]-q[1])>2.5)) return q;
      }
      return [(seg.a[0]+seg.b[0])/2, (seg.a[1]+seg.b[1])/2];
    }],
  ];
  for(const [name, pick] of cases){
    const w=await p.evaluate(pick);
    const s=await p.evaluate((w)=>{ const h=window.__hook();
      const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
      const A=h.W2S(w[0],w[1]); return {x:rc.left+A.x, y:rc.top+A.y}; }, w);
    fs.writeFileSync('mv_a.png', await p.locator('canvas').first().screenshot());
    await p.mouse.move(s.x, s.y);
    await p.mouse.down();
    await p.mouse.move(s.x+40, s.y+28);
    await p.mouse.move(s.x+90, s.y+60);
    await p.mouse.up();
    await p.waitForTimeout(300);
    fs.writeFileSync('mv_b.png', await p.locator('canvas').first().screenshot());
    const moved=await p.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      return (P.objects||[]).filter(o=>(o.dx||0)||(o.dy||0)).length; });
    console.log(name+': objects with a new position:', moved,
                '| pixels that changed:', await diff('mv_a.png','mv_b.png'));
  }
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
