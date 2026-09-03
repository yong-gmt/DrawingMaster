/* ============================================================================
   §10  DXF EXPORT THAT ANOTHER CAD CAN ACTUALLY EDIT
   ----------------------------------------------------------------------------
   The old writer traced the screen. Everything came out as loose polylines on
   layer "0" - no tables, no blocks, and not one DIMENSION entity. Open that
   anywhere else and there is nothing to edit: a dimension is a heap of strokes,
   a hidden line is a row of dashes, and every layer the drawing had is gone.

   This writer publishes the MODEL instead:
     - a LAYER table, with each entity back on the layer it came in on
     - an LTYPE table, so hidden and centre lines are line TYPES again rather
       than chopped-up segments
     - a real DIMENSION entity for every dimension we understand, carrying its
       own definition points, so the receiving CAD rebuilds it as a dimension it
       can select, drag and re-measure
     - a BLOCK per dimension holding the drawn form, as the DXF spec requires

   Written as AC1009 (R12): the widest-read DXF there is, and every construct
   used here is part of that spec - nothing invented, nothing that needs a
   forgiving reader.
   ========================================================================== */
const DXF_LT={
  CONTINUOUS:{d:'Solid line',        pat:[]},
  HIDDEN:    {d:'Hidden __ __ __',   pat:[3.0,-1.5]},
  CENTER:    {d:'Center ____ _ ____',pat:[9.5,-1.5,1.5,-1.5]},
  PHANTOM:   {d:'Phantom ___ _ _ ___',pat:[12.5,-1.5,1.5,-1.5,1.5,-1.5]},
};
/* A layer name has to survive the trip: R12 allows letters, digits and $-_ only. */
function dxfLayerName(s){
  s=String(s==null?'':s).trim();
  if(!s) return 'GEOMETRY';
  s=s.replace(/[^A-Za-z0-9_$\-.]+/g,'_').replace(/^_+|_+$/g,'').slice(0,31);
  return s||'GEOMETRY';
}
function dxfLineType(p){
  const d=p&&p.dash;
  if(!d || !d.length) return 'CONTINUOUS';
  if(d.length>=6) return 'PHANTOM';
  if(d.length>=4) return 'CENTER';
  return 'HIDDEN';
}
/* R12 files are read as a code page, not as UTF-8, so a diameter symbol written
   raw comes out as mojibake at the other end. DXF has its own control codes for
   exactly these three engineering symbols and every reader knows them - unlike
   \U+XXXX, which belongs to MTEXT and which plain readers show literally
   (\U+220512.00 instead of a diameter sign, as a re-open showed). */
function dxfStr(s){
  return String(s==null?'':s)
    .replace(/[\u2205\u2300\u00D8\u00F8\u03A6\u03C6]/g,'%%c')   /* diameter */
    .replace(/\u00B0/g,'%%d')                                    /* degree */
    .replace(/\u00B1/g,'%%p');                                   /* plus-minus */
}
function dxfNum(n){ n=+n; if(!isFinite(n)) n=0; return (Math.abs(n)<1e-9?0:n).toFixed(4); }

/* ---- the pieces a dimension is drawn from, in world millimetres ----------- */
function dxfDimPieces(pg, id){
  const out={lines:[], solids:[], texts:[]};
  (pg.objects||[]).forEach(o=>{
    const dx=o.dx||0, dy=o.dy||0;
    (o.prims.polys||[]).forEach(p=>{
      if(p._dim!==id || !p.pts || p.pts.length<2) return;
      const pts=p.pts.map(q=>[q[0]+dx, q[1]+dy]);
      out.lines.push({pts, lt:dxfLineType(p)});
      if(p._arrow) dxfArrowSolids(p._arrow, pts).forEach(s=>out.solids.push(s));
    });
    (o.prims.texts||[]).forEach(t=>{ if(t._dim===id)
      out.texts.push({x:t.x+dx, y:t.y+dy, h:t.h, text:String(t.text), rot:t.rot||0,
                      align:(t.align==null?0:t.align)}); });
  });
  return out;
}
/* The arrowheads are caps of a line in our model; a DXF file needs them as real
   filled triangles, so they are built here at the moment of writing. */
function dxfArrowSolids(A, pts){
  const out=[], h=A.h||2.5, w=(A.w? A.w/2 : h/6);
  const tri=(tip, from)=>{
    const dx=tip[0]-from[0], dy=tip[1]-from[1], L=Math.hypot(dx,dy);
    if(L<1e-9) return;
    const ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
    const b=[tip[0]-ux*h, tip[1]-uy*h];
    out.push([tip, [b[0]+nx*w, b[1]+ny*w], [b[0]-nx*w, b[1]-ny*w]]);
  };
  if(A.s) tri(pts[0], pts[1]);
  if(A.e) tri(pts[pts.length-1], pts[pts.length-2]);
  return out;
}

/* A hatch has to leave here as real strokes, not just an empty outline. The
   pattern comes from the same families the screen uses, and each line is cut to
   the boundary by the even-odd rule - so islands stay unhatched exactly as they
   are on screen, and every stroke is a line the receiving CAD can edit. */
function dxfHatchLines(ht, dx, dy){
  const loops=(ht.loops||[]).map(L=>L.map(q=>[q[0]+dx, q[1]+dy]));
  if(!loops.length) return [];
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  loops.forEach(L=>L.forEach(p=>{ if(p[0]<x0)x0=p[0]; if(p[1]<y0)y0=p[1];
    if(p[0]>x1)x1=p[0]; if(p[1]>y1)y1=p[1]; }));
  const edges=[];
  loops.forEach(L=>{ for(let i=0;i<L.length;i++){
    const a=L[i], b=L[(i+1)%L.length];
    if(Math.hypot(b[0]-a[0], b[1]-a[1])>1e-9) edges.push([a,b]); } });
  const out=[];
  hatchFamilies(ht).forEach(f=>{
    const S=hatchStep(f);
    if(!(S.spacing>1e-6)) return;
    const base=[f.base[0]+dx, f.base[1]+dy];
    let k0=1e9,k1=-1e9;
    [[x0,y0],[x1,y0],[x0,y1],[x1,y1]].forEach(c=>{
      const k=((c[0]-base[0])*S.nx + (c[1]-base[1])*S.ny)/S.spacing;
      if(k<k0)k0=k; if(k>k1)k1=k; });
    k0=Math.floor(k0)-1; k1=Math.ceil(k1)+1;
    if(k1-k0>4000) return;                        /* absurdly dense: leave it out */
    for(let k=k0;k<=k1;k++){
      const px=base[0]+f.off[0]*k, py=base[1]+f.off[1]*k;
      const hits=[];
      edges.forEach(([a,b])=>{
        const ex=b[0]-a[0], ey=b[1]-a[1];
        const den=ex*S.uy - ey*S.ux;
        if(Math.abs(den)<1e-12) return;
        const t=((px-a[0])*S.uy - (py-a[1])*S.ux)/den;   /* along the edge */
        if(t<-1e-9 || t>1+1e-9) return;
        const ix=a[0]+ex*t, iy=a[1]+ey*t;
        hits.push((ix-px)*S.ux + (iy-py)*S.uy);
      });
      if(hits.length<2) continue;
      hits.sort((p,q)=>p-q);
      for(let i=0;i+1<hits.length;i+=2){
        const s0=hits[i], s1=hits[i+1];
        if(s1-s0<1e-6) continue;
        out.push([[px+S.ux*s0, py+S.uy*s0],[px+S.ux*s1, py+S.uy*s1]]);
      }
    }
  });
  return out;
}

/* ---- the writer ---------------------------------------------------------- */
function buildDXF(pg){
  const L=[], g=(c,v)=>{ L.push(c); L.push(v); };
  const layers=new Set(['0']);
  const useLayer=(n)=>{ const k=dxfLayerName(n); layers.add(k); return k; };

  /* --- gather everything first, so the LAYER table can be written up front --- */
  const ents=[];                                   // {kind, layer, lt, ...}
  const blocks=[];                                 // {name, ents:[...]}
  const dims=[];                                   // DIMENSION entities
  const modelled=new Set();

  (dimModelsOf(pg)||[]).forEach(m=>{
    if(!m.ok) return;
    modelled.add(m.id);
    const piece=dxfDimPieces(pg, m.id);
    const name='*D'+(dims.length+1);
    const lay=useLayer('DIMENSIONS');
    const bents=[];
    piece.lines.forEach(l=>bents.push({kind:'poly', layer:lay, lt:l.lt, pts:l.pts}));
    piece.solids.forEach(s=>bents.push({kind:'solid', layer:lay, pts:s}));
    piece.texts.forEach(t=>bents.push({kind:'text', layer:lay, ...t}));
    blocks.push({name, ents:bents});
    dims.push({name, layer:lay, m, text:(piece.texts[0]||null)});
  });

  /* every other primitive keeps its own layer and its own line type */
  (pg.objects||[]).forEach(o=>{
    const dx=o.dx||0, dy=o.dy||0;
    (o.prims.polys||[]).forEach(p=>{
      if(p._dim && modelled.has(p._dim)) return;    // published as a DIMENSION
      if(!p.pts || p.pts.length<2) return;
      const lay=useLayer(p._sec? 'SECTION' : (p._layer||'GEOMETRY'));
      const pts=p.pts.map(q=>[q[0]+dx, q[1]+dy]);
      /* a circle leaves as a CIRCLE and an arc as an ARC - writing them out as
         many-sided polygons is what made every hole in the exported drawing
         un-round and impossible to edit */
      if(p._round){
        ents.push({kind:(p._round.a0==null?'circle':'arc'), layer:lay, lt:dxfLineType(p),
                   cx:p._round.cx+dx, cy:p._round.cy+dy, r:p._round.r,
                   a0:p._round.a0, a1:p._round.a1});
      }else{
        ents.push({kind:'poly', layer:lay, lt:dxfLineType(p), pts});
      }
      if(p._arrow) dxfArrowSolids(p._arrow, pts).forEach(s=>
        ents.push({kind:'solid', layer:lay, pts:s}));
    });
    (o.prims.solids||[]).forEach(s=>{
      if(s._dim && modelled.has(s._dim)) return;
      ents.push({kind:'solid', layer:useLayer(s._sec?'SECTION':'GEOMETRY'),
                 pts:s.map(q=>[q[0]+dx, q[1]+dy])});
    });
    (o.prims.texts||[]).forEach(t=>{
      if(t._dim && modelled.has(t._dim)) return;
      ents.push({kind:'text', layer:useLayer(t._sec?'SECTION':(t._layer||'TEXT')),
        x:t.x+dx, y:t.y+dy, h:t.h, text:String(t.text), rot:t.rot||0,
        bold:!!t.bold, align:(t.align==null?0:t.align)});
    });
    /* a hatch keeps its boundary as a closed polyline plus its pattern strokes,
       so the fill can still be selected and re-hatched at the other end */
    (o.prims.hatches||[]).forEach(ht=>{
      const lay=useLayer('HATCH');
      (ht.loops||[]).forEach(loop=>{
        if(loop.length<3) return;
        const pts=loop.map(q=>[q[0]+dx, q[1]+dy]);
        pts.push(pts[0].slice());
        ents.push({kind:'poly', layer:lay, lt:'CONTINUOUS', pts});
      });
      try{ dxfHatchLines(ht, dx, dy).forEach(seg=>
        ents.push({kind:'poly', layer:lay, lt:'CONTINUOUS', pts:seg})); }
      catch(err){ console.warn('hatch strokes not written', err); }
    });
  });

  /* the sheet itself: frame, title block, bill of material */
  try{
    const furniture=captureSheet(pg, {skipEntities:true});
    furniture.forEach(e=>{
      if(e.t==='poly' && e.pts.length>=2)
        ents.push({kind:'poly', layer:useLayer('FRAME'), lt:'CONTINUOUS', pts:e.pts});
      else if(e.t==='fill' && e.pts.length>=3)
        ents.push({kind:'solid', layer:useLayer('FRAME'), pts:e.pts.slice(0,4)});
      else if(e.t==='text')
        ents.push({kind:'text', layer:useLayer('TITLE'), x:e.x, y:e.y, h:e.h,
                   text:String(e.text), rot:e.rot||0,
                   align:({left:0,center:1,right:2})[e.align]||0});
    });
  }catch(err){ console.warn('sheet furniture not captured', err); }

  /* --- HEADER --- */
  g(0,'SECTION'); g(2,'HEADER');
  g(9,'$ACADVER'); g(1,'AC1009');
  g(9,'$INSUNITS'); g(70,4); g(9,'$MEASUREMENT'); g(70,1);
  g(9,'$DIMSTYLE'); g(2,'ISO-DM');
  g(0,'ENDSEC');

  /* --- TABLES --- */
  g(0,'SECTION'); g(2,'TABLES');
  g(0,'TABLE'); g(2,'LTYPE'); g(70,Object.keys(DXF_LT).length);
  Object.keys(DXF_LT).forEach(n=>{ const t=DXF_LT[n];
    g(0,'LTYPE'); g(2,n); g(70,0); g(3,t.d); g(72,65);
    g(73,t.pat.length); g(40,dxfNum(t.pat.reduce((s,v)=>s+Math.abs(v),0)));
    t.pat.forEach(v=>g(49,dxfNum(v))); });
  g(0,'ENDTAB');
  const layerList=[...layers];
  g(0,'TABLE'); g(2,'LAYER'); g(70,layerList.length);
  layerList.forEach(n=>{ g(0,'LAYER'); g(2,n); g(70,0); g(62,7);
    g(6, /HIDDEN/i.test(n)?'HIDDEN':(/CENT/i.test(n)?'CENTER':'CONTINUOUS')); });
  g(0,'ENDTAB');
  g(0,'TABLE'); g(2,'STYLE'); g(70,2);
  g(0,'STYLE'); g(2,'STANDARD'); g(70,0); g(40,0); g(41,1); g(50,0); g(71,0); g(42,2.5);
  g(3,'txt'); g(4,'');
  g(0,'STYLE'); g(2,'BOLD'); g(70,0); g(40,0); g(41,1); g(50,0); g(71,0); g(42,2.5);
  g(3,'ARIALBD.TTF'); g(4,'');
  g(0,'ENDTAB');
  g(0,'TABLE'); g(2,'DIMSTYLE'); g(70,1);
  g(0,'DIMSTYLE'); g(2,'ISO-DM'); g(70,0);
  g(3,''); g(4,''); g(140,dxfNum(3.5)); g(141,dxfNum(2.5)); g(147,dxfNum(1.0));
  g(41,dxfNum(2.5)); g(42,dxfNum(1.0)); g(44,dxfNum(2.5)); g(271,2); g(73,0); g(74,0); g(77,1);
  g(0,'ENDTAB');
  g(0,'ENDSEC');

  /* --- BLOCKS: one per dimension, as the spec wants --- */
  g(0,'SECTION'); g(2,'BLOCKS');
  blocks.forEach(b=>{
    g(0,'BLOCK'); g(8,'0'); g(2,b.name); g(70,1);
    g(10,0); g(20,0); g(30,0); g(3,b.name); g(1,'');
    b.ents.forEach(e=>dxfEntity(g,e));
    g(0,'ENDBLK'); g(8,'0');
  });
  g(0,'ENDSEC');

  /* --- ENTITIES --- */
  g(0,'SECTION'); g(2,'ENTITIES');
  ents.forEach(e=>dxfEntity(g,e));
  dims.forEach(d=>dxfDimension(g,d));
  g(0,'ENDSEC'); g(0,'EOF');

  let out=''; for(let i=0;i<L.length;i+=2) out+=L[i]+'\r\n'+L[i+1]+'\r\n';
  return {text:out, layers:layerList, dimensions:dims.length, blocks:blocks.length,
          entities:ents.length};
}

function dxfEntity(g,e){
  if(e.kind==='poly'){
    if(e.pts.length===2){
      g(0,'LINE'); g(8,e.layer); if(e.lt&&e.lt!=='CONTINUOUS') g(6,e.lt);
      g(10,dxfNum(e.pts[0][0])); g(20,dxfNum(e.pts[0][1])); g(30,0);
      g(11,dxfNum(e.pts[1][0])); g(21,dxfNum(e.pts[1][1])); g(31,0);
    }else{
      const closed=Math.hypot(e.pts[0][0]-e.pts[e.pts.length-1][0],
                              e.pts[0][1]-e.pts[e.pts.length-1][1])<1e-6;
      const pts=closed? e.pts.slice(0,-1) : e.pts;
      g(0,'POLYLINE'); g(8,e.layer); if(e.lt&&e.lt!=='CONTINUOUS') g(6,e.lt);
      g(66,1); g(70,closed?1:0); g(10,0); g(20,0); g(30,0);
      pts.forEach(p=>{ g(0,'VERTEX'); g(8,e.layer);
        g(10,dxfNum(p[0])); g(20,dxfNum(p[1])); g(30,0); });
      g(0,'SEQEND'); g(8,e.layer);
    }
  }else if(e.kind==='solid'){
    const q=e.pts.slice(); while(q.length<4) q.push(q[q.length-1]);
    g(0,'SOLID'); g(8,e.layer);
    const ord=[q[0],q[1],q[3],q[2]];
    g(10,dxfNum(ord[0][0])); g(20,dxfNum(ord[0][1])); g(30,0);
    g(11,dxfNum(ord[1][0])); g(21,dxfNum(ord[1][1])); g(31,0);
    g(12,dxfNum(ord[2][0])); g(22,dxfNum(ord[2][1])); g(32,0);
    g(13,dxfNum(ord[3][0])); g(23,dxfNum(ord[3][1])); g(33,0);
  }else if(e.kind==='circle'){
    g(0,'CIRCLE'); g(8,e.layer); if(e.lt&&e.lt!=='CONTINUOUS') g(6,e.lt);
    g(10,dxfNum(e.cx)); g(20,dxfNum(e.cy)); g(30,0); g(40,dxfNum(e.r));
  }else if(e.kind==='arc'){
    g(0,'ARC'); g(8,e.layer); if(e.lt&&e.lt!=='CONTINUOUS') g(6,e.lt);
    g(10,dxfNum(e.cx)); g(20,dxfNum(e.cy)); g(30,0); g(40,dxfNum(e.r));
    g(50,dxfNum(e.a0)); g(51,dxfNum(e.a1));
  }else if(e.kind==='text'){
    g(0,'TEXT'); g(8,e.layer);
    g(10,dxfNum(e.x)); g(20,dxfNum(e.y)); g(30,0);
    g(40,dxfNum(e.h)); g(1,dxfStr(e.text));
    if(e.rot) g(50,dxfNum(e.rot));
    g(72,e.align||0); g(73,0);
    g(11,dxfNum(e.x)); g(21,dxfNum(e.y)); g(31,0);
    /* Bold is a property of the text STYLE in DXF, not of the entity, so a bold
       label points at a bold style rather than carrying a flag nothing would read. */
    g(7, e.bold? 'BOLD' : 'STANDARD');
  }
}
/* The definition points are what make a dimension a dimension: they say what was
   measured, so the receiving CAD can re-measure it rather than trust our text. */
/* What the value should say. If the drawing's own string is just the measurement
   we hand back "<>" and let the reader measure. If it carries something extra
   ("2x R3.00", a tolerance, a note) that part is kept around the "<>". */
/* A reader that rebuilds the dimension from its definition points instead of
   showing our block needs to be told HOW to draw it, or it falls back to its own
   defaults - which for a diameter means a line right across the circle with an
   arrowhead at each end, one of them nowhere near the value. These are the
   standard DIMSTYLE overrides, carried as XDATA exactly as AutoCAD writes them,
   so the leader form survives whichever way the file is read. */
function dxfDimOverrides(g, m){
  const rad=(m.kind==='radial'||m.kind==='diameter');
  const A=(m.line&&m.line.arrow)||2.5, T=(m.text&&m.text.h)||3.5;
  g(1001,'ACAD'); g(1000,'DSTYLE'); g(1002,'{');
  g(1070,41);  g(1040,dxfNum(A));            // DIMASZ  - arrowhead size
  g(1070,140); g(1040,dxfNum(T));            // DIMTXT  - text height
  g(1070,147); g(1040,dxfNum(4/dimPxPerMM())); // DIMGAP - the same 4 px clear space
  g(1070,271); g(1070,2);                    // DIMDEC  - two decimals
  g(1070,40);  g(1040,dxfNum(1));            // DIMSCALE
  if(rad){
    g(1070,174); g(1070,0);                  // DIMTIX  - value stays outside
    g(1070,172); g(1070,0);                  // DIMTOFL - no line drawn across
    g(1070,141); g(1040,dxfNum(A*0.35));     // DIMCEN  - the small centre mark
  }
  g(1002,'}');
}
function dxfDimText(m){
  const raw=(m.text && m.text.override!=null)? String(m.text.override).trim() : '';
  if(!raw) return '<>';
  const val=(m.kind==='radial')? m.radius
          : (m.kind==='diameter')? m.radius*2
          : (m.kind==='angular')? Math.abs(m.sweep)*180/Math.PI
          : Math.abs(dimSpanOf(m).t2-dimSpanOf(m).t1);
  /* find the measurement inside the string and swap it for <> */
  const num=raw.match(/\d+(?:\.\d+)?/g);
  if(num){
    for(const t of num){
      if(Math.abs(parseFloat(t)-val)<0.02){
        const i=raw.lastIndexOf(t);
        const out=raw.slice(0,i)+'<>'+raw.slice(i+t.length);
        // a leading R or diameter sign is supplied by the dimension's own type,
        // so leaving ours in would print it twice
        return out.replace(/(^|\s)(R|\u2205|\u2300|\u00D8|\u00F8|%%c|%%C)\s*<>$/, '$1<>');
      }
    }
  }
  return raw;
}
function dxfDimension(g,d){
  const m=d.m, T=d.text;
  const tx=T? T.x : 0, ty=T? T.y : 0;
  g(0,'DIMENSION'); g(8,d.layer); g(2,d.name);
  g(11,dxfNum(tx)); g(21,dxfNum(ty)); g(31,0);
  g(12,0); g(22,0); g(32,0);
  g(3,'ISO-DM');
  if(m.kind==='angular'){
    /* Written the way the file gave it: the two measured lines, and a point on the
       arc that fixes its radius. The reader works the angle out from those, so the
       value stays a measurement rather than a number we typed. */
    const V=m.centre, r=m.radius;
    const at=(a)=>[V[0]+r*Math.cos(a), V[1]+r*Math.sin(a)];
    const e1=at(m.a0), e2=at(m.a0+m.sweep), mid=at(m.a0+m.sweep/2);
    g(13,dxfNum(e1[0])); g(23,dxfNum(e1[1])); g(33,0);   // first line, far end
    g(14,dxfNum(V[0]));  g(24,dxfNum(V[1]));  g(34,0);   // ...to the vertex
    g(15,dxfNum(e2[0])); g(25,dxfNum(e2[1])); g(35,0);   // second line, far end
    g(10,dxfNum(V[0]));  g(20,dxfNum(V[1]));  g(30,0);   // ...to the vertex
    g(16,dxfNum(mid[0])); g(26,dxfNum(mid[1])); g(36,0); // a point on the arc
    g(70,2+32+128);
    /* Group 42 for an angular dimension is in RADIANS - the source file stores
       0.383972 for a 22 degree angle. Writing degrees there made the value in the
       exported file read as 22 radians. */
    g(42,dxfNum(Math.abs(m.sweep)));
    g(40,0);
  }
  else if(m.kind==='radial' || m.kind==='diameter'){
    const isDia=(m.kind==='diameter');
    const C=m.centre, P=m.point;
    if(isDia){
      const O=[2*C[0]-P[0], 2*C[1]-P[1]];          // the far side of the circle
      g(10,dxfNum(O[0])); g(20,dxfNum(O[1])); g(30,0);
      g(70,3+32+128);
      g(15,dxfNum(P[0])); g(25,dxfNum(P[1])); g(35,0);
      g(42,dxfNum(2*m.radius));
    }else{
      g(10,dxfNum(C[0])); g(20,dxfNum(C[1])); g(30,0);
      g(70,4+32+128);
      g(15,dxfNum(P[0])); g(25,dxfNum(P[1])); g(35,0);
      g(42,dxfNum(m.radius));
    }
    g(40,0);
  }else{
    const S=dimSpanOf(m), u=m.dir, n=[-u[1],u[0]];
    const A=[u[0]*S.tA+n[0]*m.line.q, u[1]*S.tA+n[1]*m.line.q];
    g(10,dxfNum(A[0])); g(20,dxfNum(A[1])); g(30,0);
    g(70,(m.kind==='aligned'?1:0)+32+128);
    g(13,dxfNum(m.measure.p1[0])); g(23,dxfNum(m.measure.p1[1])); g(33,0);
    g(14,dxfNum(m.measure.p2[0])); g(24,dxfNum(m.measure.p2[1])); g(34,0);
    g(50,dxfNum(Math.atan2(u[1],u[0])*180/Math.PI));
    g(42,dxfNum(Math.abs(S.t2-S.t1)));
  }
  /* "<>" tells the reader to show ITS OWN measurement. Writing the number as
     literal text pins it: the dimension stops being a measurement and becomes a
     label that lies as soon as anybody edits the geometry. Only a genuine
     override - a prefix like "2x" or a note the drawing added - is written out. */
  g(1, dxfStr(dxfDimText(m)));
  /* XDATA has to be the LAST thing in an entity - anything written after it is
     swallowed by the extended data and lost. */
  dxfDimOverrides(g, m);
}
