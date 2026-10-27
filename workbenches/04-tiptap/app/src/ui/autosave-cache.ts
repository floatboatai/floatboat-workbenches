let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('floatboat-working-copies',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('本机草稿存储不可用。'));
  });
}
export async function writeCache(key:string,value:unknown):Promise<void> {
  const store=await db();
  await new Promise<void>((resolve,reject)=>{const tx=store.transaction('drafts','readwrite');tx.objectStore('drafts').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('本机草稿未写入。'));});
}
export async function readCache(key:string):Promise<unknown> {
  const store=await db();
  return new Promise((resolve,reject)=>{const r=store.transaction('drafts','readonly').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function clearCache(key:string):Promise<void> {
  const store=await db();await new Promise<void>((resolve,reject)=>{const tx=store.transaction('drafts','readwrite');tx.objectStore('drafts').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
}
