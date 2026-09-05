/* The same "the file printed a whole number" case, drawn the different ways a
   real CAD export draws it. Whichever of these STYLIZE leaves alone is the shape
   the recovery pass cannot see. */
const fs=require('fs'), path=require('path');
const g=(c,v)=>c+'\n'+v+'\n';
const line=(l,x0,y0,x1,y1)=>g(0,'LINE')+g(8,l)+g(10,x0)+g(20,y0)+g(30,0)+g(11,x1)+g(21,y1)+g(31,0);
const solid=(l,pts)=>{ let s=g(0,'SOLID')+g(8,l);
  [10,11,12,13].forEach((c,i)=>{ const p=pts[Math.min(i,pts.length-1)];
    s+=g(c,p[0])+g(c+10,p[1])+g(c+20,0); }); return s; };
const lw=(l,pts,closed)=>{ let s=g(0,'LWPOLYLINE')+g(8,l)+g(90,pts.length)+g(70,closed?1:0);
  pts.forEach(p=>{ s+=g(10,p[0])+g(20,p[1]); }); return s; };
const text=(l,x,y,h,str)=>g(0,'TEXT')+g(8,l)+g(10,x)+g(20,y)+g(30,0)+g(40,h)+g(1,str)+g(72,1)+g(11,x)+g(21,y)+g(31,0);

/* one dimension, drawn with the arrowhead style given */
function dim(span, str, y, style){
  const x0=50, x1=x0+span; let e='';
  e+=line('Dims', x0, y-6, x0, y+2);
  e+=line('Dims', x1, y-6, x1, y+2);
  e+=line('Dims', x0, y, x1, y);
  const head=(x,dir)=>{
    const pts=[[x+1.2*dir, y+0.45],[x, y],[x+1.2*dir, y-0.45]];
    if(style==='solid') return solid('Dims', pts);
    if(style==='poly')  return lw('Dims', pts, true);         // closed outline, not filled
    if(style==='tick')  return line('Dims', x-0.9, y-0.9, x+0.9, y+0.9);   // architectural slash
    return '';                                                 // 'none'
  };
  e+=head(x0,+1)+head(x1,-1);
  e+=text('Dims', (x0+x1)/2, y+1.2, 2.5, str);
  return e;
}
const FILES={
  /* every dimension a whole number, and the geometry agrees - the plain case */
  'dec_whole.dxf':      [[24,'24',110,'solid'],[18,'18',95,'solid'],[7,'7',80,'solid']],
  /* arrowheads drawn as a closed outline instead of a filled SOLID */
  'dec_polyhead.dxf':   [[24,'24',110,'poly'],[18,'18',95,'poly']],
  /* architectural tick marks instead of arrowheads */
  'dec_tick.dxf':       [[24,'24',110,'tick'],[18,'18',95,'tick']],
  /* the drawing is at 1:2 - the text says 24, the paper spans 12 */
  'dec_scaled.dxf':     [[12,'24',110,'solid'],[9,'18',95,'solid']],
  /* the number carries a unit */
  'dec_units.dxf':      [[24,'24 mm',110,'solid'],[18,'18mm',95,'solid']],
};
Object.entries(FILES).forEach(([name,cases])=>{
  let e=line('0',40,60,40,140)+line('0',140,60,140,140);
  cases.forEach(([span,str,y,style])=>{ e+=dim(span,str,y,style); });
  const out=path.join(__dirname,'..','fixtures','synthetic',name);
  fs.writeFileSync(out,
    g(0,'SECTION')+g(2,'HEADER')+g(9,'$INSUNITS')+g(70,4)+g(0,'ENDSEC')
   +g(0,'SECTION')+g(2,'ENTITIES')+e+g(0,'ENDSEC')+g(0,'EOF'));
  console.log('wrote '+name);
});
