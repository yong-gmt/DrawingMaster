/* ============================================================================
   §9  SECTION MARKER MODEL
   ----------------------------------------------------------------------------
   A cutting-plane marker means something: the arrows say WHICH WAY you are
   looking. Get the direction wrong and the drawing now describes a different
   part, so the direction is read once from the file and never recomputed.

   How it is read: the file draws the arrowhead as a filled triangle. Its apex
   minus the middle of its base IS the viewing direction - a fact, not a guess.
   The previous pass compared the arrow's CENTROID with the end of the cut line
   and inferred the direction from which side it fell on. For these drawings the
   arrow sits behind the cut line pointing at it, so that test read the direction
   backwards and STYLIZE flipped every arrow.

   What it draws: ONE polyline. It runs out along the viewing direction at one
   end, turns a right angle at the cut, runs the length of the cut, turns again
   and runs out at the other end, with an arrowhead capping each outer end. One
   line with two elbows - not a heap of separate strokes that have to be found
   again next time.
   ========================================================================== */
const SEC_LEG_MM=7.0;                    /* how far the elbow leg runs out */
const SEC_LETTER_SCALE=1.4;              /* the letter reads larger than a dimension */
/* long dash, gap, dot, gap, dot, gap - millimetres. ISO 128 draws a cutting
   plane as a phantom line; solid would read as an edge of the part. */
const SEC_PHANTOM_DASH=[12.5,1.5,1.5,1.5,1.5,1.5];
const SEC_LABEL_GAP_PX=4;                /* same clear space as a dimension value */
function secDot(p,v){ return p[0]*v[0]+p[1]*v[1]; }
/* Apex minus base-middle: the direction the arrowhead points. */
function secArrowDir(sd){
  const p=[]; (sd||[]).forEach(q=>{ if(!p.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<1e-6)) p.push(q); });
  if(p.length<3) return null;
  let best=null;
  for(let i=0;i<3;i++){
    const a=p[(i+1)%3], b=p[(i+2)%3];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const len=Math.hypot(p[i][0]-mid[0], p[i][1]-mid[1]);
    if(!best||len>best.len) best={len, mid, apex:p[i], wid:Math.hypot(a[0]-b[0],a[1]-b[1])};
  }
  if(!best || best.len<1e-6) return null;
  return { dir:[(best.apex[0]-best.mid[0])/best.len, (best.apex[1]-best.mid[1])/best.len],
           len:best.len, wid:best.wid, apex:best.apex };
}
/* Everything a section marker is made of, computed from the model. */
function secGeomOf(s){
  const leg=s.leg||SEC_LEG_MM;
  const E0=s.ends[0], E1=s.ends[1];
  const pts=[
    [E0.p[0]+E0.view[0]*leg, E0.p[1]+E0.view[1]*leg],
    E0.p.slice(), E1.p.slice(),
    [E1.p[0]+E1.view[0]*leg, E1.p[1]+E1.view[1]*leg]
  ];
  /* The letter belongs BEYOND THE ARROWHEAD, further along the direction of
     sight - it names the view you get when you look that way, so it has to sit on
     that side. Putting it on the cut line's own axis (where the file happened to
     draw it) reads as if it labelled the cut rather than the view.

     The clear space between the arrow tip and the letter is the same 4 px used
     everywhere else, and it is measured to the nearest INK of the glyph - which
     for a sideways view is the edge of the letter and for an up-or-down view is
     its top or its baseline. */
  const th=s.label.h||3.5, str=s.letter||'A';
  const ink=dimInk(th, str), w=dimTextWidth(str, th);
  const gap=(s.label.gapPx==null? SEC_LABEL_GAP_PX : s.label.gapPx)/dimPxPerMM();
  /* Push the anchor out until the CLOSEST corner of the ink box is `gap` from the
     tip. Which corner that is depends on the direction, so ask all four rather
     than assume: looking left or right it is the side of the letter, looking down
     it is the letter's top, looking up it is its baseline. */
  const corners=[[-w/2,-ink.desc],[w/2,-ink.desc],[-w/2,ink.asc],[w/2,ink.asc]];
  const reach=(v)=>Math.max(0, -Math.min(...corners.map(c=>c[0]*v[0]+c[1]*v[1])));
  /* ...and sit the letter squarely ON the leg, not hanging off it. Across the
     viewing direction the glyph's own middle - halfway between its baseline and
     its top - is what has to line up, never the baseline. */
  const mid=(ink.asc-ink.desc)/2;
  const place=(tip,v)=>{
    const n=[-v[1], v[0]], d=gap+reach(v);
    return [ tip[0]+v[0]*d - n[0]*(mid*n[1]),
             tip[1]+v[1]*d - n[1]*(mid*n[1]) ];
  };
  const labels=[ place(pts[0], E0.view), place(pts[3], E1.view) ];
  return { pts, labels, arrow:{h:s.arrow.len, w:s.arrow.wid} };
}
/* ---- reading the markers out of an imported drawing -----------------------
   Found by SHAPE, not by layer name. A cutting-plane marker has a signature no
   other annotation has: two arrowheads pointing the SAME way, sitting on a line
   at right angles to that direction, with a matching pair of letters beside them.
   Dimension arrows point at each other and carry a number, so they cannot match.

   Keying off a layer called "Section Lines" only worked for files that happened
   to use that name; a drawing that puts its cut on a centre line was invisible to
   it, and STYLIZE then fell back to the old guesswork.
   ========================================================================== */
/* Apex and direction of an arrowhead drawn as an outline: the corner furthest
   from the midpoint of the other two is the tip, and the tip minus that midpoint
   is the way it points - the same reading used for filled arrowheads. */
function secArrowFromPts(pts){
  const u=[];
  (pts||[]).forEach(q=>{ if(!u.some(r=>Math.hypot(r[0]-q[0], r[1]-q[1])<1e-6)) u.push(q); });
  if(u.length<3 || u.length>4) return null;
  let best=null;
  for(let i=0;i<u.length;i++){
    const rest=u.filter((_,k)=>k!==i);
    const mid=[rest.reduce((a,c)=>a+c[0],0)/rest.length,
               rest.reduce((a,c)=>a+c[1],0)/rest.length];
    const L=Math.hypot(u[i][0]-mid[0], u[i][1]-mid[1]);
    if(!best || L>best.L) best={L, apex:u[i], mid};
  }
  if(!best || best.L<1e-6) return null;
  return { apex:best.apex, len:best.L,
           dir:[(best.apex[0]-best.mid[0])/best.L, (best.apex[1]-best.mid[1])/best.L] };
}
function secIsCutCandidate(p){
  if(p._section) return true;
  const L=String(p._layer||'');
  if(/section|cut|cent(er|re)|smart/i.test(L)) return true;
  return !!p.dash;                       /* a chain line is a plausible cut line */
}
function v2SectionModels(out, mm){
  const solids=[];
  /* An arrowhead that the file says belongs to a DIMENSION is not a section
     marker's arrowhead, however convincingly it lines up. Two dimension arrows can
     stand at opposite ends of a view, point the same way, and have a matching pair
     of letters somewhere near - and then the marker is built on them: its line sits
     where they are rather than where the cut is, and it faces whichever way they
     face. Measured on a real drawing, every arrowhead both markers had been built
     from belonged to a dimension. */
  (out.solids||[]).forEach((sd,i)=>{
    if(sd._dim) return;
    const A=secArrowDir(sd); if(A) solids.push({i, sd, A}); });
  if(solids.length<2) return [];
  const labels=[];
  (out.texts||[]).forEach((t,i)=>{ const s=String(t.text||'').trim();
    if(/^[A-Z]'?$/.test(s)) labels.push({i, t, s}); });
  const segs=[], blobs=[];
  (out.polys||[]).forEach((p,i)=>{
    if(!p.pts || p.pts.length<2) return;
    const a=p.pts[0], b=p.pts[1], L=Math.hypot(b[0]-a[0], b[1]-a[1]);
    if(p.pts.length!==2 || L<1e-6){
      /* Not a plain segment - a closed outline, most likely the arrowhead drawn as
         a little triangle rather than a filled solid. It still belongs to the
         marker and still has to be taken over, or it is left showing through the
         new one. Only straight two-point strokes were ever looked at before, so
         these survived every restyle. */
      blobs.push({i, p, pts:p.pts, tagged:!!p._section});
      return;
    }
    segs.push({i, p, a, b, L, u:[(b[0]-a[0])/L,(b[1]-a[1])/L], cut:secIsCutCandidate(p)});
  });

  const models=[]; let seq=1;
  for(let i=0;i<solids.length;i++){
    const S1=solids[i]; if(S1.taken) continue;
    for(let j=i+1;j<solids.length;j++){
      const S2=solids[j]; if(S2.taken) continue;
      const v=S1.A.dir;
      if(v[0]*S2.A.dir[0]+v[1]*S2.A.dir[1] < 0.99) continue;      /* must look the same way */
      const jx=S2.A.apex[0]-S1.A.apex[0], jy=S2.A.apex[1]-S1.A.apex[1];
      const jl=Math.hypot(jx,jy);
      if(jl<15) continue;                                          /* too close to be a cut */
      const ju=[jx/jl, jy/jl];
      if(Math.abs(ju[0]*v[0]+ju[1]*v[1])>0.08) continue;           /* cut runs across the view */
      /* a matching pair of letters, one near each arrow */
      const byLetter={};
      labels.forEach(l=>{ if(l.taken) return; (byLetter[l.s]||(byLetter[l.s]=[])).push(l); });
      let letter=null, pair=null, bestScore=1e9;
      Object.keys(byLetter).forEach(k=>{
        const g=byLetter[k]; if(g.length<2) return;
        const near=(A)=>{ let best=null, bd=1e9;
          g.forEach(l=>{ const d=Math.hypot(l.t.x-A[0], l.t.y-A[1]); if(d<bd){bd=d;best=l;} });
          return {l:best, d:bd}; };
        const n1=near(S1.A.apex), n2=near(S2.A.apex);
        if(!n1.l || !n2.l || n1.l===n2.l) return;
        const sc=n1.d+n2.d;
        if(sc<bestScore && n1.d<30 && n2.d<30){ bestScore=sc; letter=k; pair=[n1.l, n2.l]; }
      });
      if(!letter) continue;
      /* the cut line: whatever plausible strokes lie along the join, else the join
         between the two arrowheads itself */
      /* A cutting plane is PERPENDICULAR to the direction you look through it -
         that is what a section is. Taking the cut's direction from the line joining
         the two arrowheads let a tilt in, because the pair that identifies a marker
         is not always the pair it is drawn with: a dimension arrow standing near
         the same end and pointing the same way can be picked, and it sits a few
         millimetres off the true line. Measured on a real drawing, that put a 4.9 mm
         lean into an 86 mm cut - visibly crooked, and pointing slightly wrong.

         So the axis is taken from the viewing direction, which both arrowheads
         agree on, and only its POSITION is fitted to them. The cut then cannot be
         anything but straight and square to the view. */
      const vAvg=[(S1.A.dir[0]+S2.A.dir[0])/2, (S1.A.dir[1]+S2.A.dir[1])/2];
      const vL=Math.hypot(vAvg[0], vAvg[1]);
      if(vL>1e-6){
        const vu=[vAvg[0]/vL, vAvg[1]/vL];
        const cut=[-vu[1], vu[0]];                 /* across the view */
        if(cut[0]*ju[0] + cut[1]*ju[1] < 0){ cut[0]=-cut[0]; cut[1]=-cut[1]; }
        ju[0]=cut[0]; ju[1]=cut[1];                /* keep the ends in the order found */
      }
      const n=[-ju[1], ju[0]];
      /* sit the line midway between the two arrowheads, so neither is favoured */
      const q=((S1.A.apex[0]*n[0]+S1.A.apex[1]*n[1]) +
               (S2.A.apex[0]*n[0]+S2.A.apex[1]*n[1]))/2;
      let t0=secDot(S1.A.apex,ju), t1=secDot(S2.A.apex,ju);
      if(t0>t1){ const x=t0; t0=t1; t1=x; }
      /* Claim only strokes that BELONG to this marker: collinear with it and
         contained within it, give or take a little. A stroke that carries on past
         the arrows is the part's own centre line - the marker is drawn on it, it
         is not part of it, and deleting it would take real geometry with it. */
      const PAD=6;
      const along=(p)=>secDot(p,ju), across=(p)=>secDot(p,n)-q;
      const inBox=(s)=>{
        const ta=along(s.a), tb=along(s.b), qa=across(s.a), qb=across(s.b);
        return Math.min(ta,tb)>t0-PAD && Math.max(ta,tb)<t1+PAD
            && Math.abs(qa)<SEC_LEG_MM+PAD && Math.abs(qb)<SEC_LEG_MM+PAD;
      };
      const mine=segs.filter(s=>!s.taken && s.cut
        && Math.abs(s.u[0]*ju[0]+s.u[1]*ju[1])>0.99
        && Math.abs(across(s.a))<0.8 && Math.abs(across(s.b))<0.8
        && Math.min(along(s.a),along(s.b))>t0-PAD
        && Math.max(along(s.a),along(s.b))<t1+PAD);
      /* The little arms the file drew at right angles to the cut are part of the
         marker too - the file said so by putting them on its section layer. They
         are replaced by the elbow, so they must be taken over as well, or the old
         drawing is left showing underneath the new one. */
      const arms=segs.filter(s=>!s.taken && s.p._section && !mine.includes(s) && inBox(s));
      const shapes=blobs.filter(x=>!x.taken && x.tagged && x.pts.every(pt=>
        along(pt)>t0-PAD && along(pt)<t1+PAD && Math.abs(across(pt))<SEC_LEG_MM+PAD));
      /* An arrowhead is drawn differently by every program: a filled solid, a
         closed triangle, an open three-point polyline, or two loose strokes. Rather
         than name each shape, take whatever lies inside the arrowhead's own
         FOOTPRINT - a small box at the tip, pointing back the way the arrow came.
         Nothing else belongs there, and anything bigger than the arrow is left
         alone, so a real edge of the part can never be swallowed by this. */
      const headBox=(A)=>{
        const d=A.dir, len=(A.len||3.5), wid=(A.wid||1.2);
        const nx=-d[1], ny=d[0];
        return (pt)=>{
          const vx=pt[0]-A.apex[0], vy=pt[1]-A.apex[1];
          const back=-(vx*d[0]+vy*d[1]);            /* behind the tip */
          const side=Math.abs(vx*nx+vy*ny);
          return back>=-len*0.35 && back<=len*1.5 && side<=wid*1.4;
        };
      };
      const heads=[headBox(S1.A), headBox(S2.A)];
      const spanOf=(pts)=>{ let m=0;
        for(let a=0;a<pts.length;a++) for(let bq=a+1;bq<pts.length;bq++)
          m=Math.max(m, Math.hypot(pts[a][0]-pts[bq][0], pts[a][1]-pts[bq][1]));
        return m; };
      const headLimit=Math.max(S1.A.len||3.5, S2.A.len||3.5)*1.8;
      const inHead=(pts)=>spanOf(pts)<=headLimit &&
        heads.some(h=>pts.every(pt=>h(pt)));
      blobs.forEach(x=>{ if(!x.taken && !shapes.includes(x) && inHead(x.pts)) shapes.push(x); });
      const headSegs=segs.filter(s2=>!s2.taken && !mine.includes(s2) && inHead([s2.a,s2.b]));

      mine.forEach(s=>[s.a,s.b].forEach(p=>{ const t=secDot(p,ju); if(t<t0)t0=t; if(t>t1)t1=t; }));
      const P=(t)=>[ju[0]*t+n[0]*q, ju[1]*t+n[1]*q];
      const ends=[P(t0), P(t1)];
      /* keep each arrowhead with the end it actually sits at */
      const dA=Math.hypot(S1.A.apex[0]-ends[0][0], S1.A.apex[1]-ends[0][1]);
      const dB=Math.hypot(S2.A.apex[0]-ends[0][0], S2.A.apex[1]-ends[0][1]);
      const E=(dA<=dB)? [S1,S2] : [S2,S1];
      const LP=(dA<=dB)? pair : [pair[1], pair[0]];
      const id='sec'+(seq++);
      S1.taken=true; S2.taken=true;
      S1.sd._sec=id; S2.sd._sec=id;
      /* Read every collinear stroke to find where the cut starts and stops, but
         only take OWNERSHIP of the ones the file itself marked as section lines.
         A chain line on a "centres" layer may sit along the cut without being part
         of it, and a marker that deletes it has destroyed the drawing's geometry
         to tidy up its own annotation. Read freely; delete only what is yours. */
      /* The two arrowheads that gave the marker away are not always the two the
         marker is drawn with. A dimension arrow standing at the same end, pointing
         the same way, can be picked as one of the pair - and then the marker's OWN
         arrowhead at that end is never claimed, and survives every restyle sitting
         underneath the new one.

         So do not rely on the pair. Once the ends are known, take EVERY arrowhead
         that stands at one of them and looks the way this marker looks: same
         viewing direction, and close enough to the end to be part of it. */
      const viewDir=[E[0].A.dir, E[1].A.dir];
      /* A marker's arrowhead sits AT the end of its cut, not somewhere along it.
         Reaching three arrow-lengths in took a dimension's arrowhead that stood
         1.7 mm inside the end and happened to lie on the same line - and that
         dimension could then never be rebuilt. One arrow length of slack is what
         a marker needs; more than that belongs to somebody else. */
      const REACH=Math.max(S1.A.len||3.5, S2.A.len||3.5)*1.2 + 0.6;
      /* A marker's own arrowhead stands AT the end of its cut, on the cut's line.
         Requiring only "near an end and pointing the same way" swept up dimension
         arrowheads that happened to stand a few millimetres off to the side - and
         on a drawing whose dimensions are flattened to plain geometry there is no
         tag to tell them apart, so the dimension simply lost its arrowhead and
         could never be rebuilt. Measured on one sheet: seven dimensions lost.
         Standing ON the line is what makes it the marker's. */
      const looksLikeOurs=(apex, dir)=>{
        for(let k=0;k<2;k++){
          if(Math.hypot(apex[0]-ends[k][0], apex[1]-ends[k][1])>REACH) continue;
          if(dir[0]*viewDir[k][0] + dir[1]*viewDir[k][1] <= 0.99) continue;
          const off=Math.abs((apex[0]-ends[k][0])*n[0] + (apex[1]-ends[k][1])*n[1]);
          if(off>1.2) continue;                 /* off the cut's own line */
          return true;
        }
        return false;
      };
      /* A marker has exactly TWO arrowheads: one at each end. Claiming every
         arrowhead that qualified took a second one standing just inside the end -
         a dimension's, pointing the same way along the same line - and that
         dimension could then never be rebuilt. One per end, the nearest. */
      for(let k=0;k<2;k++){
        let best=null, bd=1e9;
        solids.forEach(S=>{
          if(S.taken) return;
          if(S.A.dir[0]*viewDir[k][0] + S.A.dir[1]*viewDir[k][1] <= 0.99) return;
          const off=Math.abs((S.A.apex[0]-ends[k][0])*n[0] + (S.A.apex[1]-ends[k][1])*n[1]);
          if(off>1.2) return;
          const d=Math.hypot(S.A.apex[0]-ends[k][0], S.A.apex[1]-ends[k][1]);
          if(d>REACH) return;
          if(d<bd){ bd=d; best=S; }
        });
        if(best){ best.taken=true; best.sd._sec=id; }
      }
      blobs.forEach(x=>{
        if(x.taken || shapes.includes(x)) return;
        const A=secArrowFromPts(x.pts);
        if(A && looksLikeOurs(A.apex, A.dir)) shapes.push(x);
      });

      /* A stroke the FILE marked as a section line, lying along this cut and
         OVERLAPPING it, is the marker's - however far it runs. Requiring it to sit
         entirely inside the span left the full-length cut line unclaimed, showing
         solid underneath the new phantom one. The ends still come from the
         arrowheads; this only decides ownership. */
      const alongCut=segs.filter(s2=>!s2.taken && s2.p._section && s2.cut
        && Math.abs(s2.u[0]*ju[0]+s2.u[1]*ju[1])>0.99
        && Math.abs(across(s2.a))<0.8 && Math.abs(across(s2.b))<0.8
        && Math.max(along(s2.a),along(s2.b))>t0-PAD
        && Math.min(along(s2.a),along(s2.b))<t1+PAD);
      mine.filter(s=>s.p._section).concat(arms).concat(headSegs).concat(alongCut)
          .forEach(s=>{ s.taken=true; s.p._sec=id; });
      shapes.forEach(x=>{ x.taken=true; x.p._sec=id; });
      LP.forEach(l=>{ l.taken=true; l.t._sec=id; });
      models.push({ id, letter, pending:true,   /* drawn when STYLIZE is pressed */
        ends:[ {p:ends[0], view:E[0].A.dir}, {p:ends[1], view:E[1].A.dir} ],
        leg:SEC_LEG_MM,
        arrow:{ len:(E[0].A.len||3.5), wid:(E[0].A.wid||1.2) },
        label:{ h:(LP[0].t.h||3.5), gapPx:SEC_LABEL_GAP_PX },
        labelIds:LP.map(l=>l.i), ok:true });
      break;
    }
  }
  return models;
}
function secTranslate(s, dx, dy){
  s.ends.forEach(E=>{ E.p=[E.p[0]+dx, E.p[1]+dy]; });
}
function secModelsOf(pg){ return (pg && pg.dxf && pg.dxf.secs) || []; }
function secModelById(pg,id){ for(const s of secModelsOf(pg)) if(s.id===id && s.ok) return s; return null; }
/* Which section marker the current selection is, if it is exactly one. */
function selectedSecId(){
  let id=null;
  for(const sid of selIds){ const o=objById(sid); if(!o) continue;
    const k=o._sec; if(!k) return null;
    if(id===null) id=k; else if(id!==k) return null; }
  return id;
}
/* Grips: one at each end of the cut, dragged ALONG the cut to make it longer or
   shorter, and one on each leg to set how far the arrow stands off. The cut can
   only slide along its own line - a cutting plane that wandered sideways would be
   cutting somewhere else. */
function secGrips(pg){
  const id=selectedSecId(); if(!id) return [];
  const s=secModelById(pg,id); if(!s) return [];
  secBake(pg,s);
  const g=secGeomOf(s);
  return [ {s, kind:'end', idx:0, at:s.ends[0].p.slice()},
           {s, kind:'end', idx:1, at:s.ends[1].p.slice()},
           {s, kind:'leg', idx:0, at:g.pts[0].slice()},
           {s, kind:'leg', idx:1, at:g.pts[3].slice()} ];
}
function secBake(pg, s){
  let dx=null, dy=null, same=true;
  (pg.objects||[]).forEach(o=>{ if(o._sec!==s.id) return;
    if(dx===null){ dx=o.dx||0; dy=o.dy||0; }
    else if((o.dx||0)!==dx || (o.dy||0)!==dy) same=false; });
  if(dx===null || (!dx && !dy) || !same) return;
  secTranslate(s, dx, dy);
  (pg.objects||[]).forEach(o=>{ if(o._sec===s.id){ o.dx=0; o.dy=0; } });
}
function secAxis(s){
  const v=[s.ends[1].p[0]-s.ends[0].p[0], s.ends[1].p[1]-s.ends[0].p[1]];
  const L=Math.hypot(v[0],v[1])||1;
  return [v[0]/L, v[1]/L];
}
/* Redraw a marker from its model: one polyline with two elbows, arrowheads
   capping the outer ends, and the letters set to the sheet's text size. */
/* Cover the centre line the cutting plane is drawn along.
   Only a stroke that is (a) exactly along the cut, (b) inside its span, and
   (c) recognisably a CENTRE line - a chain line, or on a layer named for centres -
   and (d) not part of a dimension. An object edge that happens to be collinear is
   left alone, because hiding a real edge is far worse than showing two chain
   lines. */
function secCoverCentreLine(pg, s){
  const g=secGeomOf(s), A=g.pts[1], B=g.pts[2];
  const L=Math.hypot(B[0]-A[0], B[1]-A[1]); if(!(L>1e-6)) return 0;
  const u=[(B[0]-A[0])/L, (B[1]-A[1])/L], n=[-u[1], u[0]];
  let n1=0;
  (pg.objects||[]).forEach(o=>{
    const dx=o.dx||0, dy=o.dy||0;
    (o.prims.polys||[]).forEach(p=>{
      if(p._sec===s.id || p._dim || !p.pts || p.pts.length!==2) return;
      const isCentre = !!p.dash || /cent/i.test(String(p._layer||''));
      if(!isCentre){ if(p._secUnder){ delete p._secUnder; } return; }
      const a=[p.pts[0][0]+dx, p.pts[0][1]+dy], b=[p.pts[1][0]+dx, p.pts[1][1]+dy];
      const off=(q)=>Math.abs((q[0]-A[0])*n[0] + (q[1]-A[1])*n[1]);
      const at =(q)=>(q[0]-A[0])*u[0] + (q[1]-A[1])*u[1];
      const along=(off(a)<0.5 && off(b)<0.5);
      const inside=(Math.min(at(a),at(b))>-1 && Math.max(at(a),at(b))<L+1);
      if(along && inside){ p._secUnder=s.id; n1++; }
      else if(p._secUnder===s.id) delete p._secUnder;
    });
  });
  return n1;
}
function secApply(pg, s, txtH){
  if(txtH) s.label.h=txtH*SEC_LETTER_SCALE;      /* only STYLIZE resizes it */
  const g=secGeomOf(s);
  let host=null, line=null;
  const mine=[];
  (pg.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>{ if(p._sec===s.id){ mine.push({o,p}); if(!host) host=o;
      if(p._secLine) line={o,p}; } });
  });
  if(!host){
    /* the marker may have had no stroke of its own (its cut was drawn on the
       part's centre line, which we must not touch) - give it one */
    (pg.objects||[]).forEach(o=>{
      if(host) return;
      if((o.prims.texts||[]).some(t=>t._sec===s.id)) host=o;
      if((o.prims.solids||[]).some(sd=>sd._sec===s.id)) host=o;
    });
    if(!host) return false;
  }
  if(!line){
    const p={_src:'SECTION', _sec:s.id, _secLine:true, pts:[], dash:null, _section:true};
    /* Into the DRAWING as well as the object list. A marker whose cut runs along
       the part's own centre line owns no stroke of its own, so one is made for it
       here - and a stroke that lives only in the object list is gone the moment
       the objects are rebuilt, which is every time the program is reopened. The
       marker then had letters and no line, and STYLIZE had to be pressed again to
       put it back. */
    if(pg.dxf && pg.dxf.polys) pg.dxf.polys.push(p);
    host.prims.polys.push(p); line={o:host, p}; mine.push(line);
  }
  const dx=line.o.dx||0, dy=line.o.dy||0;
  line.p.pts=g.pts.map(p=>[p[0]-dx, p[1]-dy]);
  line.p._arrow={s:true, e:true, h:g.arrow.h, w:g.arrow.w};
  line.p.dash=SEC_PHANTOM_DASH.slice(); line.p._ansi=true;
  try{ secCoverCentreLine(pg, s); }catch(e){}
  /* the other strokes the file used for this marker are now part of that one line */
  mine.forEach(m=>{ if(m.p!==line.p) m.p.pts=[]; });
  /* Its arrowheads are caps of the line now, so the loose ones go - from the
     DRAWING, not just from the object list. Removing them only from the objects
     left them in the drawing, and the objects are rebuilt from the drawing every
     time the program is reopened: the old arrowheads came back, and pressing
     STYLIZE again could not remove them because by then they were nobody's. */
  (pg.objects||[]).forEach(o=>{ const S=o.prims.solids; if(!S) return;
    for(let i=S.length-1;i>=0;i--) if(S[i]._sec===s.id) S.splice(i,1); });
  if(pg.dxf && pg.dxf.solids)
    pg.dxf.solids=pg.dxf.solids.filter(sd=>sd._sec!==s.id);
  /* letters: upright, sheet text size, just beyond each end of the cut */
  const texts=[];
  (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(t._sec===s.id) texts.push({o,t}); }));
  /* each letter goes with the END it belongs to, not with whatever order the
     file listed them in */
  const order=texts.map((T,k)=>k).sort((a,b)=>{
    const pa=[texts[a].t.x+(texts[a].o.dx||0), texts[a].t.y+(texts[a].o.dy||0)];
    const pb=[texts[b].t.x+(texts[b].o.dx||0), texts[b].t.y+(texts[b].o.dy||0)];
    const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    return (d(pa,s.ends[0].p)-d(pa,s.ends[1].p)) - (d(pb,s.ends[0].p)-d(pb,s.ends[1].p));
  });
  order.forEach((idx,k)=>{
    const T=texts[idx];
    const P=g.labels[k] || g.labels[0];
    /* The size is a property of the MODEL, set once. Scaling the drawn text on
       every apply meant a drag multiplied the letter by 1.4 per mouse move, so it
       ballooned off the sheet after a few. Read the size, never compound it. */
    T.t.rot=0; T.t.align=1; T.t.h=s.label.h;
    /* the model already worked out where the baseline goes - nudging it again by
       a fraction of the text height double-counts the same correction */
    T.t.x=P[0]-(T.o.dx||0); T.t.y=P[1]-(T.o.dy||0);
    T.t._ansiDone=true;
  });
  return true;
}

/* ---- a way to ask the drawing what is still sitting on a marker -------------
   When a marker still looks wrong on a drawing I cannot see, this prints exactly
   what is left at each of its ends, and who owns it. Run it in the browser
   console:  __hook().secReport()
   Anything listed with owner "nobody" that looks like an arrowhead is a leftover
   the rules did not recognise - that listing is what tells me which rule to add,
   instead of guessing at another shape. */
/* Draw every section marker from its model.
   Objects are rebuilt FROM the drawing whenever a project is opened, which brings
   back the original arrowheads and strokes a marker had taken over - they were
   only ever blanked in the objects, never in the drawing itself. Dimensions
   survive that because dimRelayout redraws them; markers had no such step, so a
   project came back looking as if it had never been through STYLIZE, and only a
   second press put it right. */
function secRelayout(pg){
  if(!pg || !pg.objects) return 0;
  let h=3.5;
  try{ h=(store.format.fontSize||10)*PT_TO_MM; }catch(e){}
  let n=0;
  secModelsOf(pg).forEach(s=>{ if(s.ok && !s.pending){ try{ if(secApply(pg, s, h)) n++; }catch(e){} } });
  return n;
}
/* Fold every object's move into the drawing itself.
   An object carries dx/dy while it is being dragged about; the drawing underneath
   still holds the original coordinates. Rebuilding the objects - which importing a
   second file has to do - throws those offsets away, and everything that had been
   moved springs back to where it was first placed. Baking makes the moves part of
   the drawing, so nothing can lose them. */
function bakeOffsets(pg){
  const objs=(pg&&pg.objects)||[];
  let n=0;
  objs.forEach(o=>{
    const dx=o.dx||0, dy=o.dy||0;
    if(!dx && !dy) return;
    (o.prims.polys||[]).forEach(p=>{
      if(p._baked) return; p._baked=1;
      p.pts=(p.pts||[]).map(q=>[q[0]+dx, q[1]+dy]);
      if(p._round){ p._round.cx+=dx; p._round.cy+=dy; } });
    (o.prims.texts||[]).forEach(t=>{ if(t._baked) return; t._baked=1; t.x+=dx; t.y+=dy; });
    (o.prims.hatches||[]).forEach(h=>{ if(h._baked) return; h._baked=1;
      h.loops=(h.loops||[]).map(l=>l.map(q=>[q[0]+dx,q[1]+dy])); });
    (o.prims.clines||[]).forEach(c=>{ if(c._baked) return; c._baked=1; c.x+=dx; c.y+=dy; });
    n++;
  });
  if(!n) return 0;
  /* solids live in the drawing's own array, so move them there */
  const moved=new Map();
  objs.forEach(o=>{ const dx=o.dx||0, dy=o.dy||0;
    if(!dx && !dy) return;
    (o.prims.solids||[]).forEach(sd=>moved.set(sd,[dx,dy])); });
  const d=pg.dxf||{};
  (d.solids||[]).forEach((sd,i)=>{ const m=moved.get(sd); if(!m) return;
    const nn=sd.map(q=>[q[0]+m[0], q[1]+m[1]]);
    nn._dim=sd._dim||null; nn._sec=sd._sec||null; nn._section=sd._section; d.solids[i]=nn; });
  /* and the models, so a redraw puts them where the strokes now are */
  const shift=(id, list, fn)=>{
    (list||[]).forEach(mm=>{
      let dx=null, dy=null, same=true;
      objs.forEach(o=>{ if(o[id]!==mm.id) return;
        if(dx===null){ dx=o.dx||0; dy=o.dy||0; }
        else if((o.dx||0)!==dx || (o.dy||0)!==dy) same=false; });
      if(dx===null || (!dx&&!dy) || !same) return;
      fn(mm, dx, dy); });
  };
  shift('_dim', d.dims, (m,dx,dy)=>dimTranslate(m,dx,dy));
  shift('_sec', d.secs, (m,dx,dy)=>secTranslate(m,dx,dy));
  shift('_bal', d.balloons, (m,dx,dy)=>{ m.c=[m.c[0]+dx,m.c[1]+dy];
                                          m.tip=[m.tip[0]+dx,m.tip[1]+dy]; });
  objs.forEach(o=>{ o.dx=0; o.dy=0; });
  (d.polys||[]).forEach(p=>{ delete p._baked; });
  (d.texts||[]).forEach(t=>{ delete t._baked; });
  (d.hatches||[]).forEach(h=>{ delete h._baked; });
  (d.clines||[]).forEach(c=>{ delete c._baked; });
  return n;
}
function secReport(){
  const pg=activePage(); if(!pg||!pg.dxf) return 'open a sheet first';
  const rows=[];
  (pg.dxf.secs||[]).filter(s=>s.ok).forEach(s=>{
    s.ends.forEach((E,k)=>{
      (pg.objects||[]).forEach(o=>{
        const dx=o.dx||0, dy=o.dy||0;
        (o.prims.polys||[]).forEach(p=>{
          const A=(p.pts||[]).map(q=>[q[0]+dx,q[1]+dy]); if(!A.length) return;
          if(!A.some(q=>Math.hypot(q[0]-E.p[0], q[1]-E.p[1])<10)) return;
          let span=0;
          for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++)
            span=Math.max(span, Math.hypot(A[i][0]-A[j][0], A[i][1]-A[j][1]));
          rows.push({ marker:s.id, end:k, kind:'stroke', points:A.length,
            spanMM:+span.toFixed(2), layer:p._layer||'', 
            owner:p._sec? ('section '+p._sec) : p._dim? ('dimension '+p._dim) : 'nobody' });
        });
        (o.prims.solids||[]).forEach(x=>{
          const c=[x.reduce((a,q)=>a+q[0],0)/x.length+dx, x.reduce((a,q)=>a+q[1],0)/x.length+dy];
          if(Math.hypot(c[0]-E.p[0], c[1]-E.p[1])>10) return;
          rows.push({ marker:s.id, end:k, kind:'filled shape', points:x.length,
            owner:x._sec? ('section '+x._sec) : x._dim? ('dimension '+x._dim) : 'nobody' });
        });
      });
    });
  });
  if(console.table) console.table(rows); else console.log(rows);
  /* Only shapes that could BE an arrowhead are worth reporting: a small closed
     outline or a filled shape. Small arcs of the part itself pass close to a
     marker all the time and are nobody's annotation, which is correct. */
  const suspect=rows.filter(r=>r.owner==='nobody' &&
    (r.kind==='filled shape' || (r.points>=3 && r.points<=5 && r.spanMM<8)));
  console.log(rows.length+' item(s) near the marker ends · '+suspect.length+
              ' that could be a leftover arrowhead');
  if(suspect.length) console.log('leftovers:', suspect);
  return rows;
}
