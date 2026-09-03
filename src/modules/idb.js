/* ============================================================================
   §15  WHERE PROJECTS ARE KEPT
   ----------------------------------------------------------------------------
   localStorage gives a page about 5 MB, and it holds ONE string: every project,
   rewritten in full on every save. A dozen imported drawings fill it, and from
   then on the browser refuses to write - silently, unless you are watching the
   console. Work looks saved and is not.

   IndexedDB is the right home for this: it is measured in hundreds of megabytes
   rather than five, it stores each project as its own record, so saving one does
   not rewrite the others, and it says plainly when a write fails.

   localStorage stays as a fallback for anywhere IndexedDB is unavailable, and
   anything already stored there is moved across on first run - nobody has to
   export and re-import to keep what they had.
   ========================================================================== */
const IDB_NAME='drawingmaster', IDB_STORE='projects', IDB_VER=1;
let _idb=null, _idbBroken=false;

function idbOpen(){
  if(_idb) return Promise.resolve(_idb);
  if(_idbBroken || typeof indexedDB==='undefined') return Promise.resolve(null);
  return new Promise(res=>{
    let req;
    try{ req=indexedDB.open(IDB_NAME, IDB_VER); }
    catch(e){ _idbBroken=true; return res(null); }
    req.onupgradeneeded=()=>{ const db=req.result;
      if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, {keyPath:'id'}); };
    req.onsuccess=()=>{ _idb=req.result; res(_idb); };
    req.onerror=()=>{ _idbBroken=true; console.warn('IndexedDB unavailable', req.error); res(null); };
    req.onblocked=()=>{ _idbBroken=true; res(null); };
  });
}
function idbAll(){
  return idbOpen().then(db=>{
    if(!db) return null;
    return new Promise(res=>{
      let out=[];
      try{
        const tx=db.transaction(IDB_STORE,'readonly');
        const rq=tx.objectStore(IDB_STORE).getAll();
        rq.onsuccess=()=>res(rq.result||[]);
        rq.onerror=()=>{ console.warn('could not read projects', rq.error); res(null); };
      }catch(e){ console.warn('could not read projects', e); res(null); }
    });
  });
}
/* One record per project: saving the drawing you are working on does not rewrite
   every other drawing you have ever made. */
function idbPut(proj){
  return idbOpen().then(db=>{
    if(!db) return false;
    return new Promise(res=>{
      try{
        const plain=JSON.parse(JSON.stringify(proj, _saveShape));
        const tx=db.transaction(IDB_STORE,'readwrite');
        tx.objectStore(IDB_STORE).put(plain);
        tx.oncomplete=()=>res(true);
        tx.onerror=()=>{ console.warn('could not save', tx.error); res(false); };
        tx.onabort=()=>{ console.warn('save aborted', tx.error); res(false); };
      }catch(e){ console.warn('could not save', e); res(false); }
    });
  });
}
function idbDelete(id){
  return idbOpen().then(db=>{
    if(!db) return false;
    return new Promise(res=>{
      try{ const tx=db.transaction(IDB_STORE,'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
      }catch(e){ res(false); }
    });
  });
}
/* How much room is left, when the browser will say. */
function storageReport(){
  if(navigator.storage && navigator.storage.estimate)
    return navigator.storage.estimate().then(e=>({used:e.usage||0, quota:e.quota||0}))
                                        .catch(()=>({used:0, quota:0}));
  return Promise.resolve({used:0, quota:0});
}
