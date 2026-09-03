/* Build small DXF files that exercise the parts of the hatch pattern spec the
   sample drawings never reach: dashed definition lines, an offset that staggers
   each line along its own direction, a second family in the same pattern, and two
   separate regions that must line up because they share a base point. */
const fs=require('fs');

function g(code, val){ return code+'\n'+val+'\n'; }

function boundary(pts){
  // one polyline loop, closed
  let s=g(92, 2)          // polyline boundary
       +g(72, 0)          // no bulges
       +g(73, 1)          // closed
       +g(93, pts.length);
  pts.forEach(p=>{ s+=g(10, p[0])+g(20, p[1]); });
  s+=g(97, 0);            // no source refs
  return s;
}

// AutoCAD writes the definition-line offset in WORLD coordinates, already turned
// by the line's own angle - the ANSI31 entry in the sample drawing proves it:
// the .pat file says delta (0, .125) at 45 degrees, and the DXF carries
// (-2.245, 2.245), which is exactly that vector rotated by 45 degrees.
function wcsOffset(angleDeg, dx, dy){
  const a=angleDeg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
  return [dx*c - dy*s, dx*s + dy*c];
}
function hatch(name, loops, defLines, angle=0, scale=1){
  let s=g(0,'HATCH')+g(5,(hatch._h=(hatch._h||0x300)+1).toString(16).toUpperCase())
    +g(100,'AcDbEntity')+g(8,'HATCHTEST')+g(100,'AcDbHatch')
    +g(10,0)+g(20,0)+g(30,0)+g(210,0)+g(220,0)+g(230,1)
    +g(2,name)+g(70,0)+g(71,0)
    +g(91, loops.length);
  loops.forEach(L=>{ s+=boundary(L); });
  s+=g(75,1)+g(76,1)+g(52,angle)+g(41,scale)+g(77,0)
    +g(78, defLines.length);
  defLines.forEach(d=>{
    s+=g(53,d.angle)+g(43,d.bx)+g(44,d.by)+g(45,d.ox)+g(46,d.oy)
      +g(79,(d.dashes||[]).length);
    (d.dashes||[]).forEach(v=>{ s+=g(49,v); });
  });
  s+=g(47,0.1)+g(98,0)+g(451,0);
  return s;
}

function file(entities){
  return g(0,'SECTION')+g(2,'HEADER')
    +g(9,'$INSUNITS')+g(70,4)          // millimetres
    +g(0,'ENDSEC')
    +g(0,'SECTION')+g(2,'ENTITIES')+entities+g(0,'ENDSEC')
    +g(0,'EOF');
}

const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];

// 1. dashed pattern: 10mm dash, 5mm gap, lines 4mm apart, horizontal
const D1=wcsOffset(0, 0, 4);
const dashed = hatch('DASHTEST', [rect(0,0,60,40)],
  [{angle:0, bx:0, by:0, ox:D1[0], oy:D1[1], dashes:[10,-5]}]);

// 2. staggered: each successive line steps 6mm ALONG itself as well as 4mm across
const D2=wcsOffset(0, 6, 4);
const stagger = hatch('STAGGER', [rect(70,0,60,40)],
  [{angle:0, bx:70, by:0, ox:D2[0], oy:D2[1], dashes:[10,-5]}]);

// 3. two families crossing (a grid), continuous
const G1=wcsOffset(0, 0, 5), G2=wcsOffset(90, 0, 5);
const grid = hatch('GRIDTEST', [rect(140,0,60,40)],
  [{angle:0,  bx:140, by:0, ox:G1[0], oy:G1[1]},
   {angle:90, bx:140, by:0, ox:G2[0], oy:G2[1]}]);

// 4. two SEPARATE regions sharing one base point: their lines must be collinear
const shareA = hatch('ANSI31', [rect(0,60,40,30)],
  [{angle:45, bx:0, by:0, ox:-2.245064030267288, oy:2.245064030267288}]);
const shareB = hatch('ANSI31', [rect(50,60,40,30)],
  [{angle:45, bx:0, by:0, ox:-2.245064030267288, oy:2.245064030267288}]);

// 5. an island: outer square with a hole that must stay unhatched
const island = hatch('ANSI31', [rect(140,60,60,40), rect(155,70,30,20)],
  [{angle:45, bx:0, by:0, ox:-2.245064030267288, oy:2.245064030267288}]);

fs.writeFileSync('hatch_test.dxf',
  file(dashed+stagger+grid+shareA+shareB+island));
console.log('wrote hatch_test.dxf');
