const {open,loadDxf}=require('./harness');
const fs=require('fs');
// How much of STYLIZE is RULE-DRIVEN (a model that knows what it is) and how much
// still falls back to guessing from geometry? Guessing is what only works on the
// files it was tuned against, so this is the number that says whether STYLIZE
// really works for any file.
function sourceDims(fn){
  const s=fs.readFileSync(require('./harness').fixture(fn),'latin1').replace(/\r/g,'').split('\n').map(x=>x.trim());
  const c={}; let i=0;
  while(i<s.length-1){
    if(s[i]==='0'&&s[i+1]==='DIMENSION'){
      let j=i+2,t=0;
      while(j<s.length-1&&s[j]!=='0'){ if(s[j]==='70') t=parseInt(s[j+1])&15; j+=2; }
      c[t]=(c[t]||0)+1; i=j; continue;
    }
    i+=2;
  }
  return c;
}
const NAME={0:'linear',1:'aligned',2:'angular',3:'diameter',4:'radius',5:'angular3pt',6:'ordinate'};
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const src=sourceDims(dxf);
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const kinds={};
    (P.dxf.dims||[]).forEach(m=>{ const k=m.kind+(m.ok?'':' (unreadable)');
      kinds[k]=(kinds[k]||0)+1; });
    let modelPolys=0, fallbackPolys=0, modelTexts=0, fallbackTexts=0, untouched=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>{ if(p._dimPart||p._sec) modelPolys++;
        else if(p._ansi) fallbackPolys++; });
      (o.prims.texts||[]).forEach(t=>{ if(t._dimPart||t._sec) modelTexts++;
        else if(t._ansiDone) fallbackTexts++; else untouched++; });
    });
    return {kinds, sections:(P.dxf.secs||[]).filter(s=>s.ok).length,
            modelPolys, fallbackPolys, modelTexts, fallbackTexts, untouched};
  });
  const total=Object.values(src).reduce((a,c)=>a+c,0);
  const modelled=Object.entries(r.kinds).filter(([k])=>!/unreadable/.test(k))
                       .reduce((a,[,v])=>a+v,0);
  console.log(dxf);
  console.log('  DIMENSION in the file :',
    Object.entries(src).map(([t,n])=>`${NAME[t]||t}=${n}`).join(' '), `| total ${total}`);
  console.log('  built into a model    :', modelled, '/', total,
              '=>', JSON.stringify(r.kinds));
  console.log('  section markers read  :', r.sections);
  console.log('  drawn FROM A MODEL    :', r.modelPolys, 'lines,', r.modelTexts, 'texts');
  console.log('  drawn by the FALLBACK :', r.fallbackPolys, 'lines,', r.fallbackTexts, 'texts');
  console.log('  text only resized     :', r.untouched);
  await b.close();
 }
})();
