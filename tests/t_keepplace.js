/* Whatever was moved must still be where it was put, after a refresh.
   A move lives on the object as dx/dy, and the object list is NOT saved - it is
   rebuilt from the drawing on opening. So a move that only ever reached dx/dy is
   a move that dies on refresh: parts spring back to where the file put them, and
   a label the user added springs back to the middle of the sheet.
   This measures the drawn position - where the strokes and the text actually are
   on the paper - before and after, in millimetres. */
const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs'), path=require('path'), sharp=require('sharp');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const PROFILE=(process.env.TMP||'/tmp')+'/dm-profile-keepplace';

/* Fit the drawing in the window the same way twice, so the two pictures can be
   compared pixel for pixel: anything that came back in the wrong place shows up
   as a difference, including the filled arrowheads that carry no coordinates of
   their own in the object list. */
const fit=(p)=>p.evaluate(()=>{ const h=window.__hook();
  const P=h.store.pages.find(x=>x.id===h.store.activeId);
  h.setSelection([]); const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
/* Only the paper: the sidebar and the cursor-position readout sit over the same
   picture and say something different every time, which is nothing to do with
   where the drawing is. */
const CROP={left:400, top:40, width:900, height:640};
const diff=async(a,b)=>{
  const A=await sharp(a).extract(CROP).raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).extract(CROP).raw().toBuffer({resolveWithObject:true});
  if(A.info.width!==B.info.width || A.info.height!==B.info.height) return -1;
  let n=0; const {width,height,channels}=A.info;
  for(let i=0;i<width*height;i++){ let d=0;
    for(let c=0;c<3;c++) d=Math.max(d,Math.abs(A.data[i*channels+c]-B.data[i*channels+c]));
    if(d>60) n++; }
  return n;
};

/* Where things are ON THE PAPER: prim coordinates plus the object's own move. */
const where=(p)=>p.evaluate(()=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  let label=null;
  (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
    if(t._user) label=[+(t.x+(o.dx||0)).toFixed(2), +(t.y+(o.dy||0)).toFixed(2), String(t.text)]; }));
  /* the widest stroke on the sheet, named by its point count so the same one is
     found again after the rebuild */
  let big=null, span=-1;
  (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{
    const pts=q.pts||[]; if(pts.length<2) return;
    let a=1e9,b=1e9,c=-1e9,d=-1e9;
    pts.forEach(u=>{ a=Math.min(a,u[0]); b=Math.min(b,u[1]); c=Math.max(c,u[0]); d=Math.max(d,u[1]); });
    const s=(c-a)+(d-b);
    if(s>span){ span=s; big=[+(a+(o.dx||0)).toFixed(2), +(b+(o.dy||0)).toFixed(2), pts.length]; }
  }));
  return {label, widestStroke:big};
});

(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  const errs=[];

  // ---- session one: import, add a label, move both it and the drawing
  let c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  let p=c.pages()[0] || await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  let sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1800);

  await p.click('#btnText'); await p.waitForTimeout(400);
  await p.keyboard.type('MY LABEL'); await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  // move the label 40 right, 30 up (it is the current selection)
  await p.evaluate(()=>window.__hook().nudge(40,-30));
  await p.waitForTimeout(300);
  // and move every part of the drawing itself
  await p.evaluate(()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.setSelection((P.objects||[]).filter(o=>!(o.prims.texts||[]).some(t=>t._user)).map(o=>o.id));
    h.nudge(25,15); h.setSelection([]); });
  await p.waitForTimeout(2500);
  const before=await where(p);
  await fit(p); await p.waitForTimeout(600);
  const A=path.join(OUT,'kp_a.png');
  fs.writeFileSync(A, await p.locator('canvas').first().screenshot());
  console.log('placed          :', JSON.stringify(before));
  await c.close();

  // ---- session two: the same browser, as if the page had been refreshed
  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0] || await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1');
  if(!card){ console.log('the project was not there at all'); await c.close(); return; }
  await card.click(); await p.waitForTimeout(1500);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(1200);
  const after=await where(p);
  await fit(p); await p.waitForTimeout(600);
  const B=path.join(OUT,'kp_b.png');
  fs.writeFileSync(B, await p.locator('canvas').first().screenshot());
  console.log('after reopening :', JSON.stringify(after));

  const d=(a,b)=> (a&&b)? +Math.hypot(a[0]-b[0], a[1]-b[1]).toFixed(2) : null;
  console.log('label moved by  :', d(before.label, after.label), 'mm   (must be 0)');
  console.log('drawing moved by:', d(before.widestStroke, after.widestStroke), 'mm   (must be 0)');
  console.log('label text kept :', after.label && after.label[2]);
  console.log('pixels changed  :', await diff(A,B), '   (must be 0)');
  console.log('errors:', errs.length, errs.slice(0,3));
  await c.close();
})();
