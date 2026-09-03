const {open,loadDxf}=require('./harness');
const fs=require('fs');
// Rebuilding dimensions from bare geometry, on drawings with DIFFERENT numbers of
// them. "33 out of 33" was one file; the question is whether the rules hold when
// there are 11, or 43, and on a drawing from a different program.
const CASES=[
  ['expl_Body_Demo_Drawing_Sheet1.dxf', 'expl_Body_Demo_Drawing_Sheet1_truth.json', 'Sheet1'],
  ['expl_Head-back.dxf',                'expl_Head-back_truth.json',                'Head-back'],
  ['expl_Body_Demo_Drawing_Sheet3.dxf', 'expl_Body_Demo_Drawing_Sheet3_truth.json', 'Sheet3'],
];
(async()=>{
 for(const [dxf, truthFile, label] of CASES){
  const truth=JSON.parse(fs.readFileSync(require('./harness').fixture(truthFile),'utf8'));
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1400);
  const got=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok).forEach(m=>{
      /* along the dimension's own direction, which is what its value states -
         not the straight line between the two points it touches */
      const v = m.kind==='radial' ? m.radius
              : m.kind==='diameter' ? m.radius*2
              : Math.abs(h.dimGeomOf(m).span[1] - h.dimGeomOf(m).span[0]);
      out.push(+v.toFixed(2));
    });
    return out.sort((a,c)=>a-c);
  });
  // match each stated value to a rebuilt one, within a hundredth of a millimetre
  const pool=got.slice(); const missed=[];
  truth.forEach(v=>{
    const i=pool.findIndex(g=>Math.abs(g-v)<=Math.max(0.02, Math.abs(v)*0.002));
    if(i<0) missed.push(v); else pool.splice(i,1);
  });
  console.log((label+'                    ').slice(0,26),
    '| stated', String(truth.length).padStart(3),
    '· rebuilt', String(got.length).padStart(3),
    '· not found', String(missed.length).padStart(2),
    '· invented', String(pool.length).padStart(2),
    errs.length? ('· errors '+errs.length):'');
  if(missed.length) console.log('     not found:', JSON.stringify(missed.slice(0,8)));
  if(pool.length)   console.log('     invented :', JSON.stringify(pool.slice(0,8)));
  await b.close();
 }
})();
