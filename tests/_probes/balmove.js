const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const state=()=>{ const h=window.__hook();
  const pg=h.store.pages.find(x=>x.type==='sheet');
  const m=h.balModels(pg)[0];
  const objs=(pg.objects||[]).filter(o=>o._bal===m.id);
  // where the ring actually IS on the page = prim points + the object's offset
  const ring=objs.map(o=>({role:(o.prims.polys[0]||{})._role||'num',
                           dx:+(o.dx||0).toFixed(2), dy:+(o.dy||0).toFixed(2),
                           group:o.group}));
  const bb=h.selectionBBox? null : null;
  const R=objs.find(o=>(o.prims.polys||[]).some(p=>p._role==='ring'));
  const p0=R? R.prims.polys.find(p=>p._role==='ring').pts[0] : null;
  return { model_c:m.c.map(v=>+v.toFixed(2)), model_tip:m.tip.map(v=>+v.toFixed(2)),
           objects:ring, ringPt0:p0? [+(p0[0]+(R.dx||0)).toFixed(2), +(p0[1]+(R.dy||0)).toFixed(2)] : null,
           selected:[...h.selIds] }; };
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  await p.click('#btnSpecial'); await p.waitForTimeout(250);
  await p.click('#specialMenu [data-x="balloon"]'); await p.waitForTimeout(800);
  console.log('added   : '+JSON.stringify(await p.evaluate(state)));
  const S=async(wx,wy)=>{ const c=await p.evaluate(([x,y])=>{ const q=window.__hook().W2S(x,y);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+q.x, y:r.top+q.y}; },[wx,wy]); return c; };
  // click empty space first to drop the auto-selection, then click the ring's edge
  let e=await S(40,180); await p.mouse.click(e.x,e.y); await p.waitForTimeout(300);
  const st=await p.evaluate(state);
  const c=st.model_c;
  // grab a point ON the circle (its left edge), well away from the centre grip
  const edge=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet'); const m=h.balModels(pg)[0];
    const g=h.balGeomOf(m); return [m.c[0]-g.r, m.c[1]]; });
  let a=await S(edge[0], edge[1]);
  await p.mouse.click(a.x,a.y); await p.waitForTimeout(400);
  console.log('clicked : '+JSON.stringify((await p.evaluate(state)).selected));
  let t=await S(edge[0]+25, edge[1]-18);
  await p.mouse.move(a.x,a.y); await p.mouse.down();
  await p.mouse.move(t.x,t.y,{steps:12}); await p.mouse.up();
  await p.waitForTimeout(600);
  const D=await p.evaluate(state);
  console.log('dragged : '+JSON.stringify(D));
  const moved=[D.model_c[0]-st.model_c[0], D.model_c[1]-st.model_c[1]];
  const ringMoved=[D.ringPt0[0]-st.ringPt0[0], D.ringPt0[1]-st.ringPt0[1]];
  console.log('model moved '+JSON.stringify(moved.map(v=>+v.toFixed(2)))
             +'  strokes moved '+JSON.stringify(ringMoved.map(v=>+v.toFixed(2)))
             +'  agree='+(Math.abs(moved[0]-ringMoved[0])<0.01 && Math.abs(moved[1]-ringMoved[1])<0.01));
  fs.writeFileSync(path.join(OUT,'ui_balmove.png'), await p.locator('#stage').screenshot());

  // the tip grip must still drag on its own
  let tip=D.model_tip;
  a=await S(tip[0], tip[1]); t=await S(tip[0]+15, tip[1]+10);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(500);
  const T=await p.evaluate(state);
  console.log('tip drag: centre still '+JSON.stringify(T.model_c)+'  tip now '+JSON.stringify(T.model_tip));

  // and the returning user finds it where it was left
  const before=await p.evaluate(state);
  await p.reload(); await p.waitForTimeout(1400);
  const card=await p.$('.proj-card, .pc'); if(card) await card.click();
  await p.waitForTimeout(1200);
  const after=await p.evaluate(state);
  console.log('reload  : centre '+JSON.stringify(after.model_c)+' ring '+JSON.stringify(after.ringPt0)
    +'  kept='+(JSON.stringify(before.model_c)===JSON.stringify(after.model_c)
             && JSON.stringify(before.ringPt0)===JSON.stringify(after.ringPt0)));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
