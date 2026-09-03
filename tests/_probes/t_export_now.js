const {open,loadDxf}=require('./harness');
const fs=require('fs');
// What does the app actually WRITE OUT? Not what it draws - what lands in the file
// somebody else has to open.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const dxf=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return h.entsToDXF(h.captureSheet(P));
  });
  fs.writeFileSync('exported_now.dxf', dxf);
  const s=dxf.replace(/\r/g,'').split('\n').map(x=>x.trim());
  const kinds={}, layers={};
  for(let i=0;i<s.length-1;i+=2){
    if(s[i]==='0') kinds[s[i+1]]=(kinds[s[i+1]]||0)+1;
    if(s[i]==='8') layers[s[i+1]]=(layers[s[i+1]]||0)+1;
  }
  console.log('entity types written:', JSON.stringify(kinds));
  console.log('layers written      :', JSON.stringify(layers));
  console.log('has TABLES section  :', dxf.includes('TABLES'));
  console.log('has BLOCKS section  :', dxf.includes('BLOCKS'));
  console.log('DIMENSION entities  :', kinds.DIMENSION||0);
  await b.close();
})();
