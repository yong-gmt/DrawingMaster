const {open,loadDxf}=require('./harness');
const fs=require('fs');
// The hard case: a drawing with NO DIMENSION entities at all - every dimension
// exploded into plain lines, arrowheads and text, which is what a great many
// files from other programs look like. The values are known exactly, because the
// file was made by exploding a drawing we have.
(async()=>{
  const truth=JSON.parse(fs.readFileSync(require('./harness').fixture('exploded_truth.json'),'utf8'));
  const {open:_}=({});
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await loadDxf(pg,'exploded.dxf');
  const got=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.dims||[]).filter(m=>m.ok).map(m=>{
      const kind={linear:0, aligned:1, diameter:3, radial:4}[m.kind];
      const v=(m.kind==='radial')? m.radius
             :(m.kind==='diameter')? m.radius*2
             : Math.abs(h.dimGeomOf(m).span[1]-h.dimGeomOf(m).span[0]);
      return [kind, +v.toFixed(2)];
    }).sort((a,c)=>a[0]-c[0]||a[1]-c[1]);
  });
  const key=(x)=>x[0]+':'+x[1];
  const want=new Map(); truth.forEach(x=>want.set(key(x),(want.get(key(x))||0)+1));
  const have=new Map(); got.forEach(x=>have.set(key(x),(have.get(key(x))||0)+1));
  const missing=[], extra=[];
  want.forEach((n,k)=>{ const m=have.get(k)||0; for(let i=m;i<n;i++) missing.push(k); });
  have.forEach((n,k)=>{ const m=want.get(k)||0; for(let i=m;i<n;i++) extra.push(k); });
  const NAME={0:'linear',1:'aligned',3:'diameter',4:'radius'};
  const pretty=(a)=>a.map(k=>{const [t,v]=k.split(':'); return (NAME[t]||t)+' '+v;});
  console.log('dimensions in the original drawing :', truth.length);
  console.log('rebuilt from the exploded geometry :', got.length);
  console.log('  matched exactly                  :', got.length-extra.length);
  console.log('  NOT recovered                    :', missing.length, pretty(missing));
  console.log('  invented / wrong value           :', extra.length, pretty(extra));
  console.log('  import errors                    :', errs.length, errs.slice(0,2));
  await b.close();
})();
