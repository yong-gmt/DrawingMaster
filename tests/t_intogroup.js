/* Getting at one piece inside a group without breaking the group.
   Grouping is what makes a view move as one thing, so having to ungroup in order
   to fix one dimension - and then group again, into a different group - is the
   wrong trade. A double-click steps inside; Esc steps back out; the group itself
   is never touched, which is what the last measurement here checks.

   Everything is driven from the mouse, because this is a mouse gesture. */
const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;

const state=(p)=>p.evaluate(()=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  const sel=[...h.selIds];
  const objs=(P.objects||[]);
  const mine=new Set(objs.filter(o=>o.ug&&o.group).map(o=>o.group));
  return { selected:sel.length, inside:!!h.insideGroup(),
           groupsMadeByHand:mine.size,
           piecesInThatGroup:objs.filter(o=>o.ug&&mine.has(o.group)).length,
           /* what a dimension would bring with it, if the selection is one */
           dimsInSelection:new Set(sel.map(id=>{const o=h.objById(id); return o&&o._dim;})
                                      .filter(Boolean)).size };
});
/* the page point of an object, chosen so the click lands on ink */
const spotOf=(p,pick)=>p.evaluate(pick=>{
  const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
  const objs=(P.objects||[]).filter(o=>o.ug);
  const want = pick==='dim' ? objs.filter(o=>o._dim && (o.prims.texts||[]).length)
                            : objs.filter(o=>!o._dim && !o._sec && !o._bal &&
                                (o.prims.polys||[]).some(q=>(q.pts||[]).length>=2));
  const o=want[0]; if(!o) return null;
  let wx,wy;
  if(pick==='dim'){ const t=o.prims.texts[0]; wx=t.x+(o.dx||0); wy=t.y+(o.dy||0); }
  else { const q=o.prims.polys.find(q=>(q.pts||[]).length>=2);
         wx=(q.pts[0][0]+q.pts[1][0])/2+(o.dx||0); wy=(q.pts[0][1]+q.pts[1][1])/2+(o.dy||0); }
  const s=h.W2S(wx,wy); const rc=document.getElementById('stage').getBoundingClientRect();
  window.__want=o.id;
  return {x:rc.left+s.x, y:rc.top+s.y, id:o.id};
}, pick);

(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1800);

  // group the left half of the drawing, dimensions and all
  const box=await p.evaluate(()=>{ const h=window.__hook();
    const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const bb=h.entitiesBBox(P);
    const rc=document.getElementById('stage').getBoundingClientRect();
    const a=h.W2S(bb.minx-4, bb.maxy+4), c=h.W2S((bb.minx+bb.maxx)/2, bb.miny-4);
    return {ax:rc.left+a.x, ay:rc.top+a.y, bx:rc.left+c.x, by:rc.top+c.y}; });
  await p.mouse.move(box.ax, box.ay); await p.mouse.down();
  await p.mouse.move((box.ax+box.bx)/2, (box.ay+box.by)/2, {steps:6});
  await p.mouse.move(box.bx, box.by, {steps:6}); await p.mouse.up();
  await p.waitForTimeout(300);
  await p.keyboard.press('Control+g'); await p.waitForTimeout(400);
  const grouped=await state(p);
  console.log('grouped          :', JSON.stringify(grouped));

  // 1. a single click takes the whole group, as before
  const geo=await spotOf(p,'geometry');
  await p.mouse.click(geo.x, geo.y); await p.waitForTimeout(300);
  const one=await state(p);
  console.log('one click        :', JSON.stringify(one));

  // 2. a double-click takes just the piece under it
  await p.mouse.dblclick(geo.x, geo.y); await p.waitForTimeout(400);
  const inside=await state(p);
  const isTheOne=await p.evaluate(()=>[...window.__hook().selIds].length===1 &&
                                      [...window.__hook().selIds][0]===window.__want);
  console.log('double-click     :', JSON.stringify(inside), '| the piece under the cursor:', isTheOne);

  /* 3. and it can be moved on its own, without taking the group with it.
     Measured from where the strokes ARE, not from the offsets: a move is folded
     into the drawing as soon as it is saved, so an offset of zero afterwards
     means nothing either way. */
  const moved=await p.evaluate(()=>{ const h=window.__hook();
    const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const box=o=>{ const b=h.objBBox(o); return b? [+b.minx.toFixed(2),+b.miny.toFixed(2)] : null; };
    const before=new Map((P.objects||[]).map(o=>[o.id, box(o)]));
    h.nudge(12,0);
    let n=0, mine=0;
    (P.objects||[]).forEach(o=>{ const a=before.get(o.id), b=box(o);
      if(!a||!b) return;
      if(Math.abs(a[0]-b[0])>0.001||Math.abs(a[1]-b[1])>0.001){ n++; if(h.selIds.has(o.id)) mine++; } });
    return {piecesThatMoved:n, ofThemSelected:mine}; });
  console.log('moved on its own :', JSON.stringify(moved), '(1 piece, not the group)');

  // 4. inside the group, a dimension is still one dimension
  const dim=await spotOf(p,'dim');
  if(dim){ await p.mouse.dblclick(dim.x, dim.y); await p.waitForTimeout(400);
    const d=await state(p);
    console.log('a dimension      :', JSON.stringify(d), '(one dimension, all of its parts)'); }

  /* 5. Esc steps back out - keeping what was selected, now as the whole group.
     Inside the group the double-click above also opened the value for editing,
     which is the point of being in there; the first Esc closes that, the second
     leaves the group. One Esc, one step back. */
  const typing=await p.evaluate(()=>!!document.querySelector('.inline-edit'));
  console.log('the value opened :', typing, '(a second double-click inside edits it)');
  if(typing){ await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('Esc              :', JSON.stringify(await state(p)));
  /* and a plain click takes the whole group again. The piece was moved a moment
     ago, so ask where it is now rather than clicking where it used to be. */
  const geo2=await spotOf(p,'geometry');
  await p.mouse.click(geo2.x, geo2.y); await p.waitForTimeout(300);
  const out=await state(p);
  console.log('one click again  :', JSON.stringify(out));
  console.log('group survived   :', out.groupsMadeByHand===grouped.groupsMadeByHand &&
                                    out.piecesInThatGroup===grouped.piecesInThatGroup);
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
})();
