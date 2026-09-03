const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs'), path=require('path'), sharp=require('sharp');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const PROFILE='/tmp/dm-profile-reopen';
const CROP={left:340, top:20, width:940, height:640};
const diff=async(a,b)=>{
  const A=await sharp(a).extract(CROP).raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).extract(CROP).raw().toBuffer({resolveWithObject:true});
  let n=0; const {width,height,channels}=A.info;
  for(let i=0;i<width*height;i++){ let d=0;
    for(let c=0;c<3;c++) d=Math.max(d,Math.abs(A.data[i*channels+c]-B.data[i*channels+c]));
    if(d>60) n++; }
  return n;
};
const look=(p)=>p.evaluate(()=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  let sec=0, loose=0, ring=0;
  /* A filled shape carries its owner as a property on an ARRAY, and that is the
     thing that used to be lost on the way to storage - so count the tags too. */
  const tagged=(P.dxf.solids||[]).filter(s=>s._dim||s._sec||s._section).length;
  (P.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(q=>{ if(q._sec && (q.pts||[]).length>=4) sec++;
                                     if(q._role==='ring') ring++; });
    (o.prims.solids||[]).forEach(s=>{ if(!s._sec && !s._dim && s.length>=3) loose++; }); });
  const bb=h.entitiesBBox(P);
  return {sectionLines:sec, looseFilledShapes:loose, balloonCircles:ring,
          taggedFilledShapes:tagged, models:(P.dxf.dims||[]).length,
          markers:(P.dxf.secs||[]).length,
          box:[+bb.minx.toFixed(1),+bb.miny.toFixed(1),+bb.maxx.toFixed(1),+bb.maxy.toFixed(1)]};
});
const fit=(p)=>p.evaluate(()=>{ const h=window.__hook();
  const P=h.store.pages.find(x=>x.id===h.store.activeId);
  h.setSelection([]); const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });

(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  // ---- session one: import, stylize, arrange, add a balloon
  let c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  let p=c.pages()[0] || await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  let sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);
  await p.click('#btnStylize'); await p.waitForTimeout(1200);
  await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const some=(P.objects||[]).filter(o=>!o._dim && !o._sec).slice(0,120);
    some.forEach(o=>{ o.dx=-18; o.dy=14; });
    const m=(P.dxf.dims||[]).find(x=>x.ok && x.kind==='linear');
    if(m) m.line.q += 9;
    h.dimRelayout(P); h.render();
  });
  await p.click('#btnBalloon'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const h=window.__hook(); h.setSelection([]); h.render(); });
  await p.waitForTimeout(3800);
  await fit(p); await p.waitForTimeout(400);
  const A=path.join(OUT,'ro_a.png');
  fs.writeFileSync(A, await p.locator('canvas').first().screenshot());
  const before=await look(p);
  console.log('session 1, arranged :', JSON.stringify(before));
  await c.close();

  // ---- session two: same profile, as if the program had been closed
  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0] || await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1');
  if(!card){ console.log('the project was not there at all'); await c.close(); return; }
  await card.click(); await p.waitForTimeout(1600);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(1000);
  await fit(p); await p.waitForTimeout(3800);
  const B=path.join(OUT,'ro_b.png');
  fs.writeFileSync(B, await p.locator('canvas').first().screenshot());
  const after=await look(p);
  console.log('session 2, reopened :', JSON.stringify(after));
  console.log('pixels that changed :', await diff(A,B));
  console.log('errors:', errs.length, errs.slice(0,3));
  await c.close();
})();
