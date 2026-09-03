const {open,loadDxf}=require('./harness');
const fs=require('fs');
// How much of STYLIZE is driven by a MODEL (reads the file's own definition data,
// so it works on any drawing) and how much still falls back to guessing from the
// drawn geometry (works only when the geometry happens to look like the samples)?
(async()=>{
 const files=['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf',
              'sec_test.dxf','hatch_test.dxf'];
 for(const dxf of files){
  if(!fs.existsSync(dxf)) continue;
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const before=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    const kinds={}; (d.dims||[]).forEach(m=>{ const k=m.kind+(m.ok?'':'(not ok)');
      kinds[k]=(kinds[k]||0)+1; });
    return {models:(d.dims||[]).length, ok:(d.dims||[]).filter(m=>m.ok).length,
            kinds, secs:(d.secs||[]).length};
  });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const after=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let modelPrims=0, fallbackPrims=0, fallbackTexts=0, untouched=0;
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>{
        if(p._dimPart||p._sec) modelPrims++;
        else if(p._ansi) fallbackPrims++; });
      (o.prims.texts||[]).forEach(t=>{
        if(t._dimPart||t._sec) modelPrims++;
        else if(t._ansiDone) fallbackTexts++;
        else untouched++; });
    });
    return {modelPrims, fallbackPrims, fallbackTexts, plainTexts:untouched};
  });
  // how many DIMENSION entities does the source file actually contain?
  const src=fs.readFileSync(dxf,'latin1').replace(/\r/g,'').split('\n').map(x=>x.trim());
  let inFile=0; const byType={};
  for(let i=0;i<src.length-1;i+=2){
    if(src[i]==='0'&&src[i+1]==='DIMENSION'){ inFile++;
      for(let j=i+2;j<src.length-1&&src[j]!=='0';j+=2)
        if(src[j]==='70'){ const t=(+src[j+1])&15; byType[t]=(byType[t]||0)+1; } }
  }
  console.log(dxf);
  console.log('  DIMENSION in the file :', inFile, JSON.stringify(byType));
  console.log('  became a model        :', before.ok+'/'+before.models, JSON.stringify(before.kinds));
  console.log('  section markers read  :', before.secs);
  console.log('  STYLIZE: drawn from a model', after.modelPrims,
              '| still guessed from geometry', after.fallbackPrims+after.fallbackTexts);
  await b.close();
 }
})();
