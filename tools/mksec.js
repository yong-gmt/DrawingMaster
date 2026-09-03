/* A section marker drawn the way the picture shows it: the cut is a CENTRE LINE
   (not a layer called "Section Lines"), the arrows point the same way, and the
   letters sit beside them. If detection only works when a layer is named a
   certain way, this file will not be seen at all. */
const fs=require('fs');
const g=(c,v)=>c+'\n'+v+'\n';
function line(layer,x0,y0,x1,y1){
  return g(0,'LINE')+g(8,layer)+g(10,x0)+g(20,y0)+g(30,0)+g(11,x1)+g(21,y1)+g(31,0);
}
function solid(layer,pts){
  let s=g(0,'SOLID')+g(8,layer);
  [10,11,12,13].forEach((c,i)=>{ const p=pts[Math.min(i,pts.length-1)];
    s+=g(c,p[0])+g(c+10,p[1])+g(c+20,0); });
  return s;
}
function text(layer,x,y,h,str){
  return g(0,'TEXT')+g(8,layer)+g(10,x)+g(20,y)+g(30,0)+g(40,h)+g(1,str)+g(72,1)+g(11,x)+g(21,y)+g(31,0);
}
// vertical cut at x=100, arrows both pointing +x, letters A
const cutX=100, yTop=180, yBot=60;
let e='';
e+=line('Smart Centers', cutX, yBot-4, cutX, yTop+4);        // the cut, on a centre layer
[[yTop-2],[yBot+2]].forEach(([y])=>{
  e+=line('Smart Centers', cutX-8, y, cutX-4, y);            // the tail
  e+=solid('Smart Centers', [[cutX-4,y+0.9],[cutX,y],[cutX-4,y-0.9]]);  // arrow, apex on the cut
});
e+=text('Notes', cutX-14, yTop-3.5, 3.5, 'A');
e+=text('Notes', cutX-14, yBot+0.5, 3.5, 'A');
// a normal linear dimension nearby, which must NOT be mistaken for a section
e+=line('Dims', 130, 80, 130, 120);
e+=solid('Dims', [[129.6,81],[130,80],[130.4,81]]);
e+=solid('Dims', [[129.6,119],[130,120],[130.4,119]]);
e+=text('Dims', 133, 99, 2.5, '40.00');
fs.writeFileSync('sec_test.dxf',
  g(0,'SECTION')+g(2,'HEADER')+g(9,'$INSUNITS')+g(70,4)+g(0,'ENDSEC')
 +g(0,'SECTION')+g(2,'ENTITIES')+e+g(0,'ENDSEC')+g(0,'EOF'));
console.log('wrote sec_test.dxf');
