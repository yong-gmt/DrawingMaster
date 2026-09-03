/* ============================================================================
   §11  RECOVERY — reading a drawing that never labelled itself
   ----------------------------------------------------------------------------
   Everything so far leans on the file declaring its own dimensions with a
   DIMENSION entity. Plenty of drawings do not: exported "exploded", or written by
   a program that only emits geometry, they arrive as loose lines, filled
   triangles and numbers. Measured on the three sample drawings with their
   dimensions exploded, that left ZERO dimensions to work with - so STYLIZE had
   nothing to correct.

   This pass rebuilds the dimensions from what IS there. The anchor is the value:
   a number on a drawing is not decoration, it is the label of a measurement, and
   the measurement is right next to it. Around each value we look for the shapes a
   dimension is made of and, when they are all present and consistent, we hand the
   result to exactly the same model everything else already uses.

   It never guesses in the dark: if the pieces are not all there, the drawing is
   left untouched rather than rearranged on a hunch.
   ========================================================================== */

/* ---- what a piece of text IS ---------------------------------------------- */
const RX_NUM=/-?\d+(?:[.,]\d+)?/;
function dimTextRole(str){
  const s=String(str==null?'':str).trim();
  if(!s) return 'empty';
  if(/^[A-Z]'?$/.test(s)) return 'letter';                      /* section / detail mark */
  if(/^[A-Z]'?\s*[-–]\s*[A-Z]'?(\s*\(.*\))?$/.test(s)) return 'viewLabel';   /* A-A (2:1) */
  if(/^(SECTION|DETAIL|VIEW|SCALE)\b/i.test(s)) return 'viewLabel';
  if(/\b(VIEW|SECTION|DETAIL)\b/i.test(s) && !RX_NUM.test(s)) return 'viewLabel';
  /* a measurement: an optional count, an optional symbol, then a number */
  if(/^(\d+\s*[xX]\s*)?(R|\u2300|\u2205|\u00D8|\u00F8|%%[cC]|SR|S\u2300)?\s*\d+(?:[.,]\d+)?/.test(s)
     && RX_NUM.test(s)) return 'value';
  if(/^[\d.,\s]+$/.test(s)) return 'value';
  return 'note';
}
/* The number the value states. "2x \u23004.40" measures 4.40 - the count in front
   is how many features share this dimension, not part of the measurement. */
function dimValueNumber(str){
  const s=String(str||'').replace(/^\s*\d+\s*[xX]\s*/,'');
  const m=s.match(/-?\d+(?:[.,]\d+)?/);
  return m? parseFloat(m[0].replace(',','.')) : null;
}
/* Which kind of measurement the value announces itself as. */
function dimValueKind(str){
  const s=String(str||'').trim();
  if(/(^|\s)(\u2300|\u2205|\u00D8|\u00F8|%%[cC])/.test(s)) return 'diameter';
  if(/(^|\s)R\s*\d/.test(s)) return 'radial';
  return 'linear';
}

/* ---- what a piece of geometry IS ------------------------------------------ */
/* An arrowhead: a filled triangle, or the outline of one. Returns its tip and the
   way it points - the two facts a dimension is built from. */
function recArrowFrom(pts){
  const p=[]; (pts||[]).forEach(q=>{
    if(!p.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<1e-6)) p.push(q); });
  if(p.length!==3) return null;
  let span=0;
  for(let i=0;i<3;i++) for(let j=i+1;j<3;j++)
    span=Math.max(span, Math.hypot(p[i][0]-p[j][0], p[i][1]-p[j][1]));
  if(span<0.3 || span>12) return null;                 /* not an arrowhead-sized thing */
  let best=null;
  for(let i=0;i<3;i++){
    const a=p[(i+1)%3], b=p[(i+2)%3];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const len=Math.hypot(p[i][0]-mid[0], p[i][1]-mid[1]);
    if(!best||len>best.len) best={len, mid, tip:p[i], wid:Math.hypot(a[0]-b[0],a[1]-b[1])};
  }
  if(!best || best.len<1e-6 || best.wid<1e-6) return null;
  if(best.len/best.wid < 1.2 || best.len/best.wid > 8) return null;   /* wrong proportions */
  return {tip:best.tip, dir:[(best.tip[0]-best.mid[0])/best.len,
                             (best.tip[1]-best.mid[1])/best.len],
          len:best.len, wid:best.wid};
}
function recCollectArrows(out){
  const A=[];
  (out.solids||[]).forEach((sd,i)=>{ const a=recArrowFrom(sd); if(a){ a.src='solid'; a.i=i; A.push(a); } });
  (out.polys||[]).forEach((p,i)=>{
    const pts=p.pts||[];
    if(pts.length<3 || pts.length>5) return;
    if(Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1])>0.05) return;
    const a=recArrowFrom(pts.slice(0,-1).length>=3? pts.slice(0,-1) : pts);
    if(a){ a.src='poly'; a.i=i; a.p=p; A.push(a); }
  });
  return A;
}

/* ---- rebuilding the dimensions -------------------------------------------- */
/* A piece is available to be rebuilt unless something is actually USING it. A tag
   left over from an old save says which block a stroke came from, not that anything
   understands it - so a tag whose model no longer exists must not lock the stroke
   away, or a project saved before models existed can never be rebuilt. */
function v2RecFree(out){
  const live=new Set((out.dims||[]).filter(m=>m&&m.ok).map(m=>m.id));
  return (o)=>{ if(!o) return false; if(o._sec) return false;
    return !o._dim || !live.has(o._dim); };
}
function v2RecoverDims(out, mm, seq){
  const dims=[];
  /* Say WHY a value was not turned into a dimension. A recovery pass that fails
     silently is impossible to improve, because nobody can see what it missed. */
  const why=[]; out.recoverReport=why;
  const free=v2RecFree(out);
  /* A number on the sheet's own frame is not a dimension value. The zone numbers
     down the border read as "1", "2", "3" and pair with any arrowhead that happens
     to stand the right distance away - which is how a drawing came back with
     dimensions nobody had drawn. The frame and the title block are named by their
     layers; that is the same rule the text sizing already trusts. */
  const furniture=(t)=>/border|frame|title\s*block|^title/i.test(String(t._layer||''));
  const texts=(out.texts||[]).map((t,i)=>({t,i,role:dimTextRole(t.text)}))
                              .filter(x=>free(x.t) && x.role==='value' && !furniture(x.t));
  if(!texts.length) return dims;
  const arrows=recCollectArrows(out).filter(a=>
    free(a.src==='poly'? a.p : (out.solids[a.i]||{})));
  if(!arrows.length) return dims;
  /* every circle and arc the drawing actually contains - the ground truth a
     radius or diameter has to agree with */
  const rounds=[];
  (out.polys||[]).forEach(p=>{ if(p._round) rounds.push(p._round); });
  /* plain two-point strokes, the raw material of extension and dimension lines */
  const segs=[];
  (out.polys||[]).forEach((p,i)=>{
    if(!free(p) || !p.pts || p.pts.length!==2) return;
    const a=p.pts[0], b=p.pts[1], L=Math.hypot(b[0]-a[0], b[1]-a[1]);
    if(L<1e-6) return;
    segs.push({i,p,a,b,L,u:[(b[0]-a[0])/L,(b[1]-a[1])/L]});
  });
  const dot=(p,v)=>p[0]*v[0]+p[1]*v[1];
  const near=(p,q)=>Math.hypot(p[0]-q[0], p[1]-q[1]);

  /* Two passes. First every value proposes the matches it COULD have; then the
     best-fitting proposals are accepted in order. Committing as we go let whichever
     value happened to be read first take arrowheads that fitted another value far
     better - which is how two dimensions stacked among their neighbours were lost
     even though their arrowheads were sitting right there. */
  const cands=[];
  texts.forEach(T=>{
    const str=String(T.t.text||'');
    const kind=dimValueKind(str);
    const th=T.t.h||2.5, reach=Math.max(60, th*30);
    const tp=[T.t.x, T.t.y];
    const id='rec'+(seq.n++);

    if(kind==='radial' || kind==='diameter'){
      /* a radius names a real arc: find the arrowhead whose tip sits on one */
      const stated=dimValueNumber(str);
      arrows.forEach(a=>{
        if(near(a.tip,tp)>reach) return;
        rounds.forEach(R=>{
          if(Math.abs(near(a.tip,[R.cx,R.cy])-R.r)>0.4) return;    /* tip on this arc */
          /* ...and the arc has to BE what the value says it is. Without this the
             nearest arrowhead wins even when it sits on a completely different
             circle, which is how an R2.75 appeared that the drawing never had. */
          if(stated!=null){
            const own=(kind==='diameter')? R.r*2 : R.r;
            if(Math.abs(own-stated) > Math.max(0.05, stated*0.01)) return;
          }
          cands.push({score:near(a.tip,tp), text:T, arrows:[a], kind, R, str, th, tp, id:null});
        });
      });
      return;
    }

    /* linear: two arrowheads facing along one line, with the value beside it */
    const stated=dimValueNumber(str);
    for(let i=0;i<arrows.length;i++){
      const A=arrows[i];
      if(near(A.tip,tp)>reach) continue;
      for(let j=i+1;j<arrows.length;j++){
        const B=arrows[j];
        if(near(B.tip,tp)>reach) continue;
        if(A.dir[0]*B.dir[0]+A.dir[1]*B.dir[1] > -0.9) continue;
        const vx=B.tip[0]-A.tip[0], vy=B.tip[1]-A.tip[1];
        const L=Math.hypot(vx,vy); if(L<0.5) continue;
        const u=[vx/L, vy/L];
        if(Math.abs(u[0]*A.dir[0]+u[1]*A.dir[1])<0.98) continue;
        const n=[-u[1],u[0]];
        const across=Math.abs(dot([tp[0]-A.tip[0], tp[1]-A.tip[1]], n));
        const along=dot([tp[0]-A.tip[0], tp[1]-A.tip[1]], u);
        /* A narrow dimension parks its number well outside the extension lines -
           measured on a real drawing, 7.3 mm away from a 3.5 mm span. The window
           has to allow that. It can afford to be generous because the real filter
           is the next line: the span must BE the number the drawing states. */
        /* How far the number may sit from its own dimension line. A narrow
           dimension parks its number well outside the extension lines, and on a
           crowded drawing it is pushed further still - measured on a real sheet,
           six dimensions had a pair whose span was EXACTLY their number and were
           reported as having no arrowheads at all, purely because the number had
           been moved clear of the crowd.
           The window can afford to be generous because it is not what decides:
           the line below is, and it demands that the span BE the number the
           drawing states. A wide search cannot invent a dimension; it can only
           find one that was already there. */
        const room=Math.max(th*20, L*2, 40);
        if(across>Math.max(th*12, L*0.5, 25)) continue;
        if(along<-room || along>L+room) continue;
        if(stated!=null && Math.abs(L-stated) > Math.max(0.05, stated*0.01)) continue;
        cands.push({score:across+Math.abs(along-L/2)*0.25, text:T, arrows:[A,B],
                    kind:'linear', pair:{A,B,u,n,L}, str, th, tp, id:null});
      }
    }
  });

  /* Serve the most CONSTRAINED value first, not the best-fitting one.
     Taking the best fit first is greedy: a value with five possible pairs helps
     itself to arrowheads that were the only ones another value could ever use, and
     that other value is then reported as having no arrowheads at all - on a dense
     drawing seven of forty-three were lost that way, with arrowheads still going
     spare. A value that has exactly one possible pair must be served before a
     value that has a choice; among equals, the best fit still wins. */
  const perText=new Map();
  cands.forEach(C=>perText.set(C.text.i, (perText.get(C.text.i)||0)+1));
  cands.sort((a,b)=> (perText.get(a.text.i)-perText.get(b.text.i)) || (a.score-b.score));
  const takenText=new Set();
  cands.forEach(C=>{
    if(takenText.has(C.text.i)) return;
    /* Neighbouring dimensions in a chain SHARE an arrowhead: one dimension's
       right-hand tip is the next one's left-hand tip, drawn once. Claiming an
       arrowhead for one dimension and refusing it to every other left the next
       dimension in the chain with nothing to match - which is why a crowded sheet
       lost values that were plainly there. An arrowhead may serve the two
       dimensions that meet at it, and no more. */
    if(C.arrows.some(a=>(a.used||0)>=2)) return;
    /* ...but never twice for the SAME dimension line, which would be one
       dimension claiming both ends of somebody else's */
    if(C.arrows.every(a=>(a.used||0)>=1) && C.arrows.some(a=>a.usedBy===C.text.i)) return;
    C.arrows.forEach(a=>{ a.used=(a.used||0)+1; a.usedBy=C.text.i; });
    takenText.add(C.text.i);
    const T=C.text, str=C.str, th=C.th, tp=C.tp, kind=C.kind;
    const id='rec'+(seq.n++);
    if(kind==='radial' || kind==='diameter'){
      const best={a:C.arrows[0], R:C.R};
      const R=best.R;
      const m={ id, kind:(kind==='diameter'?'diameter':'radial'),
        centre:[R.cx,R.cy], point:best.a.tip.slice(), radius:R.r,
        line:{arrow:best.a.len, arrowW:best.a.wid, weight:DIM_LW},
        land:{y:tp[1], len:null, off:null, side:((tp[0]-best.a.tip[0])>=0?1:-1)},
        run:{len:null},
        text:{gapPx:DIM_TXT_GAP_PX, rot:0, value:'', override:null,
              h:th, align:1, scaleRot:T.t.scaleRot},
        recovered:true, ok:true };
      m.text.value=((kind==='diameter'?'\u2300':'R')+
        (kind==='diameter'? R.r*2 : R.r).toFixed(2));
      dimSplitValue(m, str);          /* keep "2x" and the symbol, free the number */
      m.refs={texts:[T.i], arrows:[best.a]};
      dims.push(m);
      return;
    }
    const pair=C.pair;
    const u=pair.u, n=pair.n;
    const q=dot(pair.A.tip, n);
    /* the extension lines: perpendicular strokes standing at each tip. Their far
       end from the dimension line is the point that was actually measured. */
    const measured=[pair.A.tip.slice(), pair.B.tip.slice()];
    const over=[2.5,2.5], usedSegs=[];
    [0,1].forEach(k=>{
      const tip=(k===0?pair.A.tip:pair.B.tip);
      const t0=dot(tip,u);
      let bestSeg=null, bd=1e9;
      segs.forEach(s=>{ if(s.used) return;
        if(Math.abs(s.u[0]*n[0]+s.u[1]*n[1])<0.98) return;          /* perpendicular */
        const d=Math.abs(dot(s.a,u)-t0);
        if(d<0.8 && d<bd){ bd=d; bestSeg=s; }
      });
      if(!bestSeg) return;
      bestSeg.used=true; usedSegs.push(bestSeg.i);
      /* The gap between the part and the extension line is empty space - nothing
         in the drawing records how wide it was. So the measured point is taken as
         the extension line's own near end and the gap as zero: the line is then
         redrawn exactly where the drawing had it, instead of somewhere a guessed
         gap would have put it. */
      const qa=dot(bestSeg.a,n), qb=dot(bestSeg.b,n);
      const beyond=(Math.abs(qa-q)<=Math.abs(qb-q))? qa : qb;      /* just past the dim line */
      const nearPart=(beyond===qa)? qb : qa;
      over[k]=Math.min(6, Math.abs(beyond-q));
      measured[k]=[u[0]*t0+n[0]*nearPart, u[1]*t0+n[1]*nearPart];
    });
    const m={ id, kind:'linear', measure:{p1:measured[0], p2:measured[1]}, dir:u,
      ext:{gap:[0,0], overshoot:over, visible:[true,true]},
      line:{q, inside:true, stub:[0,0], arrowsOut:false,
            capStart:'arrow', capEnd:'arrow',
            arrow:Math.max(pair.A.len,pair.B.len),
            arrowW:Math.max(pair.A.wid,pair.B.wid), weight:DIM_LW},
      text:{t:null, side:((dot([tp[0],tp[1]],n)-q)>=0?1:-1), gapPx:DIM_TXT_GAP_PX,
            rot:T.t.rot||0, value:'', override:null, h:th, align:1,
            scaleRot:T.t.scaleRot, outSide:1},
      recovered:true, ok:true };
    m.text.value=dimValueOf(m).toFixed(2);
    dimSplitValue(m, str);            /* keep any wrapper, free the number */
    m.refs={texts:[T.i], segs:usedSegs, arrows:[pair.A, pair.B]};
    dims.push(m);
  });
  /* whatever never found a match, and why */
  texts.forEach(T=>{ if(takenText.has(T.i))
      return;
    const str=String(T.t.text||'');
    why.push({text:str, reason:'no matching arrowheads for '+
      (dimValueNumber(str)==null?'?':dimValueNumber(str))});
  });
  return dims;
}

/* The pieces that belong to a rebuilt dimension - and ONLY those.
   An earlier version swept up everything inside the dimension's footprint, which
   quietly ate about three hundred lines of the part itself and both section
   markers. So nothing is claimed unless it can be named: the arrowheads we
   matched, the extension lines we followed, the value we read, and the strokes
   that lie on the dimension's own line between them. */
function v2RecoverRaw(out, m){
  const raw={polys:[], solids:[], texts:[], idx:{polys:[], solids:[], texts:[]}};
  const takePoly=(i)=>{ if(i==null||raw.idx.polys.includes(i)) return;
    const p=out.polys[i]; if(!p||p._round||p._sec) return;
    raw.polys.push(p); raw.idx.polys.push(i); };
  const takeSolid=(i)=>{ if(i==null||raw.idx.solids.includes(i)) return;
    raw.solids.push(out.solids[i]); raw.idx.solids.push(i); };
  (m.refs&&m.refs.texts||[]).forEach(i=>{ raw.texts.push(out.texts[i]); raw.idx.texts.push(i); });
  const arrows=(m.refs&&m.refs.arrows)||[];
  arrows.forEach(a=>{ if(a.src==='solid') takeSolid(a.i); else takePoly(a.i); });
  (m.refs&&m.refs.segs||[]).forEach(takePoly);

  if(m.kind==='radial'||m.kind==='diameter'){
    /* follow the leader away from the arrowhead, end to end, a few strokes at most */
    const tip=m.point;
    let ends=[tip], hops=0;
    const used=new Set(raw.idx.polys);
    while(hops++<4){
      let grew=false;
      (out.polys||[]).forEach((p,i)=>{
        if(used.has(i) || p._dim || p._sec || p._round || !p.pts || p.pts.length!==2) return;
        const A=p.pts[0], B=p.pts[1];
        if(Math.hypot(B[0]-A[0],B[1]-A[1])>150) return;
        const hit=ends.some(e=>Math.hypot(e[0]-A[0],e[1]-A[1])<0.4
                             || Math.hypot(e[0]-B[0],e[1]-B[1])<0.4);
        if(!hit) return;
        used.add(i); takePoly(i); ends.push(A,B); grew=true;
      });
      if(!grew) break;
    }
    return raw;
  }
  /* linear: the strokes lying ON the dimension line, within its own span */
  const u=m.dir, n=[-u[1],u[0]], S=dimSpanOf(m);
  (out.polys||[]).forEach((p,i)=>{
    if(p._dim || p._sec || p._round || !p.pts || p.pts.length!==2) return;
    const A=p.pts[0], B=p.pts[1];
    const qa=A[0]*n[0]+A[1]*n[1], qb=B[0]*n[0]+B[1]*n[1];
    if(Math.abs(qa-m.line.q)>0.8 || Math.abs(qb-m.line.q)>0.8) return;
    const ta=A[0]*u[0]+A[1]*u[1], tb=B[0]*u[0]+B[1]*u[1];
    const pad=Math.max(8, m.line.arrow*4);
    if(Math.min(ta,tb)<S.tA-pad || Math.max(ta,tb)>S.tB+pad) return;
    takePoly(i);
  });
  return raw;
}
/* Swap the loose pieces for the model's own drawing, tagged so everything
   downstream - grouping, grips, STYLIZE, export - treats it as one dimension. */
/* Mark the old pieces, do not splice them out yet. Every rebuilt dimension refers
   to its pieces BY INDEX, and splicing shifts every index after it - so removing
   the first dimension's strokes silently pointed the next one's indices at the
   wrong things, and its original number was left on the drawing underneath the new
   one. Marking is index-safe; the sweep happens once, at the end. */
function v2RecoverReplace(out, m, raw, built){
  raw.polys.forEach(p=>{ if(p) p._recDead=true; });
  raw.solids.forEach(s=>{ if(s) s._recDead=true; });
  raw.texts.forEach(t=>{ if(t) t._recDead=true; });
  built.polys.forEach(p=>out.polys.push(p));
  built.texts.forEach(t=>out.texts.push(t));
}
function v2RecoverSweep(out){
  out.polys=(out.polys||[]).filter(p=>!p._recDead);
  out.solids=(out.solids||[]).filter(s=>!s._recDead);
  out.texts=(out.texts||[]).filter(t=>!t._recDead);
}
