/* ============================================================================
   HATCH PATTERN — pure geometry, no canvas, no globals
   ----------------------------------------------------------------------------
   The first piece of this program to become a real component: it takes numbers
   in and gives numbers back, so it can be tested in milliseconds without a
   browser, and reused anywhere.

   A hatch pattern is not "some lines across the shape". DXF gives each pattern
   definition line four things and all four matter:

     angle    the direction the lines run
     base     a point the family passes through, in WORLD coordinates
     offset   the vector from one line to the NEXT, also in world coordinates.
              Its perpendicular part is the spacing; its part ALONG the line
              shifts each successive line, which is what makes brick and dashed
              patterns line up the way they do.
     dashes   the dash/gap sequence (positive = dash, negative = gap, 0 = dot)

   Using only the angle and |offset| - and measuring from each shape's own
   bounding box - is what made two neighbouring regions with the same pattern
   fail to line up.
   ========================================================================== */

/** The families of parallel lines a hatch is drawn from.
 *  Falls back to ANSI31 (45°, 3.175 mm) when the file gives no definition lines;
 *  only then do the hatch's own angle and scale need applying, because there is
 *  no pre-resolved pattern data to have baked them in already. */
export function hatchFamilies(h){
  if(h.fams && h.fams.length) return h.fams;
  const a=(h.angle||0)+Math.PI/4, s=(h.scale>0?h.scale:1), d=3.175*s;
  return [{ dir:[Math.cos(a), Math.sin(a)], base:[0,0],
            off:[-Math.sin(a)*d, Math.cos(a)*d], dashes:null }];
}

/** Split a family's offset into the two things it actually encodes. */
export function hatchStep(f){
  const L=Math.hypot(f.dir[0], f.dir[1])||1;
  const ux=f.dir[0]/L, uy=f.dir[1]/L, nx=-uy, ny=ux;
  return { ux, uy, nx, ny,
    spacing:Math.abs(f.off[0]*nx + f.off[1]*ny),   /* perpendicular: line to line */
    shift:  f.off[0]*ux + f.off[1]*uy };           /* along the line: the stagger */
}

/** DXF dash list -> a canvas dash array, in the same units.
 *  Canvas always starts with a drawn segment, so a pattern that opens with a gap
 *  gets a zero-length dash in front of it rather than being turned inside out. */
export function hatchDashArray(dashes, k){
  if(!dashes || !dashes.length) return null;
  const out=[];
  if(dashes[0]<0) out.push(0);
  let any=false;
  /* a dot is written as 0 in DXF and IS something to draw, so it counts as ink;
     counting only v>0 threw away any pattern made of dots and gaps */
  dashes.forEach(v=>{ const a=Math.abs(v)*k; out.push(a<0.1?0.1:a); if(v>=0) any=true; });
  if(!any) return null;                       /* all gaps: nothing to draw */
  if(out.length%2) out.push(0.1);             /* canvas wants pairs */
  return out;
}
