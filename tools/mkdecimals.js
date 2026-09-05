/* A drawing whose dimension TEXT is rounded harder than the geometry it measures.
   The file prints "24"; the distance it spans is 24.37. Set Format Config to two
   decimals and STYLIZE must print 24.37 - the number is measured, the file's
   string is only kept for what it wraps around it. */
const fs=require('fs'), path=require('path');
const g=(c,v)=>c+'\n'+v+'\n';
const line=(layer,x0,y0,x1,y1)=>g(0,'LINE')+g(8,layer)+g(10,x0)+g(20,y0)+g(30,0)+g(11,x1)+g(21,y1)+g(31,0);
const solid=(layer,pts)=>{ let s=g(0,'SOLID')+g(8,layer);
  [10,11,12,13].forEach((c,i)=>{ const p=pts[Math.min(i,pts.length-1)];
    s+=g(c,p[0])+g(c+10,p[1])+g(c+20,0); }); return s; };
const text=(layer,x,y,h,str)=>g(0,'TEXT')+g(8,layer)+g(10,x)+g(20,y)+g(30,0)+g(40,h)+g(1,str)+g(72,1)+g(11,x)+g(21,y)+g(31,0);

let e='';
/* the part being measured */
e+=line('0', 40, 60, 40, 140);
e+=line('0', 140, 60, 140, 140);

/* one horizontal dimension per case: [true span, the string the file prints, y] */
const CASES=[
  [24.37, '24',      110],   // rounded to a whole number - 0.37 out, well past 1%
  [18.00, '18',       95],   // exactly a whole number
  [24.37, '2x 24',    80],   // a wrapper the file adds, around a rounded number
  [24.37, '24.4',     65],   // rounded to one place
];
CASES.forEach(([span,str,y],i)=>{
  const x0=50, x1=x0+span;
  e+=line('Dims', x0, y-6, x0, y+2);            // extension lines
  e+=line('Dims', x1, y-6, x1, y+2);
  e+=line('Dims', x0, y, x1, y);                // the dimension line
  e+=solid('Dims', [[x0+1.2,y+0.45],[x0,y],[x0+1.2,y-0.45]]);
  e+=solid('Dims', [[x1-1.2,y+0.45],[x1,y],[x1-1.2,y-0.45]]);
  e+=text('Dims', (x0+x1)/2, y+1.2, 2.5, str);
});

const out=path.join(__dirname,'..','fixtures','synthetic','decimals.dxf');
fs.writeFileSync(out,
  g(0,'SECTION')+g(2,'HEADER')+g(9,'$INSUNITS')+g(70,4)+g(0,'ENDSEC')
 +g(0,'SECTION')+g(2,'ENTITIES')+e+g(0,'ENDSEC')+g(0,'EOF'));
console.log('wrote '+out);
