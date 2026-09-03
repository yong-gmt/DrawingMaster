/* Group some pieces with the mouse, drag them with the mouse, then come back to
   the project as a person would: close the browser, open it again, click the
   card. Everything that was done must still be done.

   The moving is driven from the pointer rather than from a helper, because that
   is the path a person takes and it is the one that has to hold. */
const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
const PROFILE=(process.env.TMP||'/tmp')+'/dm-profile-keepgroup';

const state=(p)=>p.evaluate(()=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  const objs=P.objects||[];
  /* groups the user made, told apart from the ones the program works out for
     itself from a dimension's own tags */
  const mine={}, dim={};
  objs.forEach(o=>{ if(!o.group) return;
    (o._dim||o._sec||o._bal? dim : mine)[o.group]=((o._dim||o._sec||o._bal? dim : mine)[o.group]||0)+1; });
  const sizes=Object.values(mine).sort((a,b)=>b-a);
  /* where the grouped pieces sit on the paper */
  let a=1e9,b=1e9,c=-1e9,d=-1e9, n=0;
  objs.forEach(o=>{ if(!o.group || !mine[o.group]) return;
    const bb=h.objBBox(o); if(!bb) return; n++;
    a=Math.min(a,bb.minx); b=Math.min(b,bb.miny); c=Math.max(c,bb.maxx); d=Math.max(d,bb.maxy); });
  return { groupsMadeByHand:sizes.length, biggestByHand:sizes[0]||0,
           groupsFromDimensions:Object.keys(dim).length,
           box: n? [+a.toFixed(1),+b.toFixed(1),+c.toFixed(1),+d.toFixed(1)] : null };
});

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

  // marquee across a corner of the drawing, then group what it caught
  /* W2S is measured from the stage, the mouse from the page: the marquee starts
     nowhere near the drawing if the stage's own corner is left out. */
  const box=await p.evaluate(()=>{ const h=window.__hook();
    const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.entitiesBBox(P);
    const rc=document.getElementById('stage').getBoundingClientRect();
    const a=h.W2S(bb.minx-4, bb.maxy+4), b=h.W2S((bb.minx+bb.maxx)/2, (bb.miny+bb.maxy)/2);
    return {ax:rc.left+a.x, ay:rc.top+a.y, bx:rc.left+b.x, by:rc.top+b.y}; });
  await p.mouse.move(box.ax, box.ay); await p.mouse.down();
  await p.mouse.move((box.ax+box.bx)/2, (box.ay+box.by)/2, {steps:8});
  await p.mouse.move(box.bx, box.by, {steps:8}); await p.mouse.up();
  await p.waitForTimeout(400);
  const picked=await p.evaluate(()=>window.__hook().selIds.size);
  console.log('marquee caught  :', picked, 'pieces');
  if(!picked){ console.log('nothing was selected - the marquee did not run', box); await c.close(); return; }
  await p.keyboard.press('Control+g'); await p.waitForTimeout(500);

  // and drag the group across the sheet with the pointer
  const from=await p.evaluate(()=>{ const h=window.__hook();
    const sb=h.selectionBBox(); const q=h.W2S((sb.minx+sb.maxx)/2, (sb.miny+sb.maxy)/2);
    const rc=document.getElementById('stage').getBoundingClientRect();
    return {x:rc.left+q.x, y:rc.top+q.y}; });
  await p.mouse.move(from.x, from.y); await p.mouse.down();
  await p.mouse.move(from.x+60, from.y-40, {steps:10});
  await p.mouse.move(from.x+120, from.y-70, {steps:10}); await p.mouse.up();
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ const h=window.__hook(); h.setSelection([]); h.render(); });
  await p.waitForTimeout(2500);
  const before=await state(p);
  console.log('grouped & moved :', JSON.stringify(before));
  await c.close();

  // ---- come back to it
  c=await chromium.launchPersistentContext(PROFILE,{viewport:{width:1400,height:900}});
  p=c.pages()[0] || await c.newPage();
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(1400);
  const card=await p.$('text=Project 1');
  if(!card){ console.log('the project was not there at all'); await c.close(); return; }
  await card.click(); await p.waitForTimeout(1500);
  sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(1200);
  const after=await state(p);
  console.log('after reopening :', JSON.stringify(after));

  // clicking one piece of the group must still take the whole group
  const takes=await p.evaluate(()=>{ const h=window.__hook();
    const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const o=(P.objects||[]).find(x=>x.group && !x._dim && !x._sec && !x._bal);
    if(!o) return 0;
    return h.expandGroup(new Set([o.id])).size; });

  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  console.log('group survived  :', before.groupsMadeByHand===after.groupsMadeByHand &&
                                   before.biggestByHand===after.biggestByHand);
  console.log('still in place  :', same(before.box, after.box), before.box, '->', after.box);
  console.log('one click takes :', takes, 'pieces   (the whole group)');
  console.log('errors:', errs.length, errs.slice(0,3));
  await c.close();
})();
