/* Undo, then carry on working. What is done after an undo must be kept just as
   firmly as what was done before one.

   A snapshot used to be a plain JSON copy of the pages, which contains the
   drawing AND the object list - as two separate copies of what had been the same
   pieces. After an undo the two were no longer joined: a move wrote into the
   object list while the drawing kept the old numbers, and the drawing is what
   gets saved. The move came back undone on the next open, but only after an undo,
   which is what made it look as if saving worked "sometimes". */
const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE=(process.env.TMP||'/tmp')+'/dm-profile-undokeeps';

/* Where the strokes of one named piece actually are, on the paper. */
const spot=(p)=>p.evaluate(()=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  let best=null, span=-1;
  (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{
    const pts=q.pts||[]; if(pts.length<2) return;
    let a=1e9,b=1e9,c=-1e9,d=-1e9;
    pts.forEach(u=>{ a=Math.min(a,u[0]); b=Math.min(b,u[1]); c=Math.max(c,u[0]); d=Math.max(d,u[1]); });
    const s=(c-a)+(d-b);
    if(s>span){ span=s; best=[+(a+(o.dx||0)).toFixed(2), +(b+(o.dy||0)).toFixed(2)]; }
  }));
  /* the tags that plain JSON drops, counted so an undo cannot quietly strip them */
  const tagged=(P.dxf.solids||[]).filter(s=>s._dim||s._sec||s._section).length;
  return {widest:best, taggedFilledShapes:tagged, models:(P.dxf.dims||[]).length};
});
const moveAll=(p,dx,dy)=>p.evaluate(([dx,dy])=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  h.setSelection((P.objects||[]).map(o=>o.id)); h.nudge(dx,dy); h.setSelection([]);
}, [dx,dy]);

(async()=>{
  fs.rmSync(PROFILE,{recursive:true,force:true});
  const errs=[];
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
  await p.click('#btnStylize'); await p.waitForTimeout(1400);

  await moveAll(p, 20, 10); await p.waitForTimeout(600);
  const moved=await spot(p);
  await p.click('#btnUndo'); await p.waitForTimeout(900);
  const undone=await spot(p);
  console.log('moved 20,10     :', JSON.stringify(moved));
  /* The undo goes back to the state before STYLIZE - nudging does not take a
     snapshot of its own - which is a harder case, not an easier one: it is the
     one where the drawing is replaced wholesale. */
  console.log('after undo      :', JSON.stringify(undone), '(back to before STYLIZE)');
  console.log('undo moved it   :', +Math.hypot(moved.widest[0]-undone.widest[0],
                                               moved.widest[1]-undone.widest[1]).toFixed(2), 'mm');

  // now carry on working: another move, which must be kept
  await moveAll(p, -30, 25); await p.waitForTimeout(2500);
  const before=await spot(p);
  console.log('moved again     :', JSON.stringify(before));
  await c.close();

  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0] || await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1');
  if(!card){ console.log('the project was not there at all'); await c.close(); return; }
  await card.click(); await p.waitForTimeout(1500);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(1200);
  const after=await spot(p);
  console.log('after reopening :', JSON.stringify(after));
  console.log('moved by        :',
    +Math.hypot(before.widest[0]-after.widest[0], before.widest[1]-after.widest[1]).toFixed(2),
    'mm   (must be 0)');
  console.log('tags kept       :', before.taggedFilledShapes, '->', after.taggedFilledShapes);
  console.log('errors:', errs.length, errs.slice(0,3));
  await c.close();
})();
