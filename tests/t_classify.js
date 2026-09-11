const {open,loadDxf}=require('./harness');
const fs=require('fs');
// The classification rules have to REJECT things too, or they are not rules.
// This file deliberately contains decoys: a dimension whose two arrows point at
// each other, and a pair of lone letters with no arrows at all - the shapes that
// look like a section marker to a careless test.
const g=(c,v)=>c+'\n'+v+'\n';
const line=(lay,x0,y0,x1,y1)=>g(0,'LINE')+g(8,lay)+g(10,x0)+g(20,y0)+g(30,0)+g(11,x1)+g(21,y1)+g(31,0);
const solid=(lay,p)=>{ let s=g(0,'SOLID')+g(8,lay);
  [10,11,12,13].forEach((c,i)=>{ const q=p[Math.min(i,p.length-1)];
    s+=g(c,q[0])+g(c+10,q[1])+g(c+20,0); }); return s; };
const text=(lay,x,y,h,t)=>g(0,'TEXT')+g(8,lay)+g(10,x)+g(20,y)+g(30,0)+g(40,h)+g(1,t)
  +g(72,1)+g(11,x)+g(21,y)+g(31,0);
let e='';
// (1) a REAL section marker: two arrows the same way, letters beside them
e+=line('Smart Centers',100,56,100,184);
[[178],[62]].forEach(([y])=>{ e+=line('Smart Centers',92,y,96,y);
  e+=solid('Smart Centers',[[96,y+0.9],[100,y],[96,y-0.9]]); });
e+=text('Notes',86,174.5,3.5,'A'); e+=text('Notes',86,58.5,3.5,'A');
// (2) DECOY: a plain dimension - two arrows pointing AT each other, no letter pair
e+=line('Dims',150,80,150,130);
e+=solid('Dims',[[149.6,81],[150,80],[150.4,81]]);
e+=solid('Dims',[[149.6,129],[150,130],[150.4,129]]);
e+=text('Dims',154,104,2.5,'50.00');
// (3) DECOY: a pair of lone letters far apart, no arrowheads at all
e+=text('Border',40,180,2.5,'B'); e+=text('Border',40,60,2.5,'B');
// (4) DECOY: two arrows the same way but with NO matching letters
e+=line('Smart Centers',210,60,210,180);
[[176],[64]].forEach(([y])=>{ e+=solid('Smart Centers',[[206,y+0.9],[210,y],[206,y-0.9]]); });
fs.writeFileSync(require('./harness').out('classify_test.dxf'),
  g(0,'SECTION')+g(2,'HEADER')+g(9,'$INSUNITS')+g(70,4)+g(0,'ENDSEC')
 +g(0,'SECTION')+g(2,'ENTITIES')+e+g(0,'ENDSEC')+g(0,'EOF'));

(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,require('./harness').out('classify_test.dxf'));
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return { sectionMarkersFound:(P.dxf.secs||[]).map(s=>s.letter),
             dimensionModels:(P.dxf.dims||[]).length };
  });
  console.log(JSON.stringify(r));
  console.log('exactly one marker, and it is the real one (A):',
              r.sectionMarkersFound.length===1 && r.sectionMarkersFound[0]==='A');
  await b.close();
})();
