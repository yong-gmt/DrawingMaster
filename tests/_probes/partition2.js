const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const pars=()=>{ const h=window.__hook();
  const pg=h.store.pages.find(x=>x.type==='sheet');
  return h.parPolys(pg).map(p=>{ const o=(pg.objects||[]).find(x=>(x.prims.polys||[]).indexOf(p)>=0);
    const dx=(o&&o.dx)||0, dy=(o&&o.dy)||0;
    return p.pts.map(q=>[q[0]+dx, q[1]+dy]); }); };
const r2=v=>+v.toFixed(2);
const fmt=a=>a.map(p=>`[${r2(p[0][0])},${r2(p[0][1])}]-[${r2(p[1][0])},${r2(p[1][1])}]`).join('  ');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  const add=async k=>{ await p.click('#btnSpecial'); await p.waitForTimeout(250);
    await p.click(`#specialMenu [data-x="${k}"]`); await p.waitForTimeout(700); };
  await add('partition'); await add('partition');
  await add('balloon');
  console.log('balloons      : '+await p.evaluate(()=>{ const h=window.__hook();
    return h.balModels(h.store.pages.find(x=>x.type==='sheet')).length; }));
  console.log('two lines     : '+fmt(await p.evaluate(pars)));

  // drag the BODY of the first line (not an end) to move the whole thing
  const S=async(wx,wy)=>{ const c=await p.evaluate(([x,y])=>{ const q=window.__hook().W2S(x,y);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+q.x, y:r.top+q.y}; },[wx,wy]); return c; };
  let L=(await p.evaluate(pars))[0];
  const midx=(L[0][0]+L[1][0])/2 + 30;               // along the line, away from any grip
  let a=await S(midx, L[0][1]), t=await S(midx+12, L[0][1]-20);
  await p.mouse.click(a.x,a.y); await p.waitForTimeout(300);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:10}); await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('after moving  : '+fmt(await p.evaluate(pars)));

  // STYLIZE must not eat them
  await p.click('#btnStylize'); await p.waitForTimeout(1500);
  console.log('after STYLIZE : '+fmt(await p.evaluate(pars)));

  // delete one
  L=(await p.evaluate(pars))[1];
  a=await S((L[0][0]+L[1][0])/2 + 25, L[0][1]);
  await p.mouse.click(a.x,a.y); await p.waitForTimeout(300);
  await p.keyboard.press('Delete'); await p.waitForTimeout(600);
  console.log('after delete  : '+fmt(await p.evaluate(pars)));

  // and the survivor comes back after a reload
  const before=await p.evaluate(pars);
  await p.reload(); await p.waitForTimeout(1400);
  const card=await p.$('.proj-card, .pc'); if(card) await card.click();
  await p.waitForTimeout(1200);
  const after=await p.evaluate(pars);
  let worst = before.length!==after.length ? Infinity : 0;
  if(isFinite(worst)) before.forEach((ln,i)=>ln.forEach((pt,j)=>pt.forEach((v,k)=>{
    worst=Math.max(worst, Math.abs(v-after[i][j][k])); })));
  console.log('after reload  : '+fmt(after)+'   worst shift = '+worst.toFixed(4)+' mm');
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
