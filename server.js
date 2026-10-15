/* Buddy Wash — LAN storage + static server (no dependencies).
   Implements the exact API the app's storage layer expects:
     GET  /api/storage/get?key=…      -> null | { value }
     POST /api/storage/set    {key,value}
     POST /api/storage/delete {key}
     GET  /api/storage/list?prefix=…  -> { keys: [...] }
   Data lives in one JSON file, written atomically, with a .bak copy and a
   daily backup (last 30 kept). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

function lanAddresses(){
  const out = [];
  Object.values(os.networkInterfaces()).forEach(list => (list||[]).forEach(i => {
    if(i.family === 'IPv4' && !i.internal) out.push(i.address);
  }));
  return out;
}

function createStore(dataDir){
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  const file = path.join(dataDir, 'data.json');
  let data = {};
  for(const f of [file, file + '.bak']){
    try{ data = JSON.parse(fs.readFileSync(f, 'utf8')); break; }catch(e){ /* try next */ }
  }
  let dirty = false, timer = null, lastBackupDay = '';
  function dailyBackup(){
    const day = new Date().toLocaleDateString('en-CA');
    if(day === lastBackupDay) return;
    lastBackupDay = day;
    try{
      fs.copyFileSync(file, path.join(dataDir, 'backups', `data-${day}.json`));
      const old = fs.readdirSync(path.join(dataDir, 'backups')).filter(n => /^data-.*\.json$/.test(n)).sort();
      while(old.length > 30) fs.unlinkSync(path.join(dataDir, 'backups', old.shift()));
    }catch(e){ console.error('Backup failed:', e.message); }
  }
  function flush(){
    if(!dirty) return;
    dirty = false;
    try{
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      if(fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
      fs.renameSync(tmp, file);
      dailyBackup();
    }catch(e){ dirty = true; console.error('Save failed:', e.message); }
  }
  function touch(){ dirty = true; clearTimeout(timer); timer = setTimeout(flush, 250); }
  return {
    file, flush,
    get: k => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
    set(k, v){ data[k] = v; touch(); },
    del(k){ delete data[k]; touch(); },
    list: p => Object.keys(data).filter(k => k.startsWith(p || ''))
  };
}

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };

function startServer({ dataDir, publicDir, port = 3000 }){
  const store = createStore(dataDir);
  const send = (res, code, body, type='application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readBody = req => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if(size > 100*1024*1024){ reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try{ resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }catch(e){ reject(e); } });
    req.on('error', reject);
  });

  const server = http.createServer(async (req, res) => {
    try{
      const u = new URL(req.url, 'http://x');
      if(u.pathname === '/api/ping') return send(res, 200, { ok:true });
      if(u.pathname === '/api/storage/get' && req.method === 'GET'){
        const v = store.get(u.searchParams.get('key') || '');
        return send(res, 200, v === null ? 'null' : { value: v });
      }
      if(u.pathname === '/api/storage/list' && req.method === 'GET')
        return send(res, 200, { keys: store.list(u.searchParams.get('prefix') || '') });
      if(u.pathname === '/api/storage/set' && req.method === 'POST'){
        const b = await readBody(req);
        if(typeof b.key !== 'string') return send(res, 400, { error:'key required' });
        store.set(b.key, b.value); return send(res, 200, { ok:true });
      }
      if(u.pathname === '/api/storage/delete' && req.method === 'POST'){
        const b = await readBody(req);
        if(typeof b.key !== 'string') return send(res, 400, { error:'key required' });
        store.del(b.key); return send(res, 200, { ok:true });
      }
      if(req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error:'method not allowed' });
      let rel = decodeURIComponent(u.pathname); if(rel === '/') rel = '/index.html';
      const full = path.normalize(path.join(publicDir, rel));
      if(!full.startsWith(path.normalize(publicDir))) return send(res, 403, 'Forbidden', 'text/plain');
      fs.readFile(full, (err, buf) => err ? send(res, 404, 'Not found', 'text/plain')
        : send(res, 200, buf, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream'));
    }catch(e){ send(res, 500, { error: String(e.message || e) }); }
  });

  return new Promise((resolve, reject) => {
    let p = port, tries = 0;
    const tryListen = () => server.listen(p, '0.0.0.0');
    server.on('error', e => {
      if(e.code === 'EADDRINUSE' && tries++ < 10){ p++; setTimeout(tryListen, 50); } else reject(e);
    });
    server.on('listening', () => resolve({ server, port: p, store, dataDir, urls: lanAddresses().map(ip => `http://${ip}:${p}`) }));
    tryListen();
  });
}

module.exports = { startServer, lanAddresses };

// Standalone mode:  node server.js   (no Electron needed — e.g. on a spare PC)
if(require.main === module){
  const dataDir = process.env.BW_DATA || path.join(__dirname, 'data');
  startServer({ dataDir, publicDir: path.join(__dirname, 'public'), port: Number(process.env.PORT) || 3000 }).then(r => {
    console.log(`Buddy Wash server running.\n  This PC:  http://localhost:${r.port}`);
    r.urls.forEach(u => console.log(`  On LAN:   ${u}`));
    console.log(`  Data:     ${r.store.file}`);
    const bye = () => { r.store.flush(); process.exit(0); };
    process.on('SIGINT', bye); process.on('SIGTERM', bye);
  }).catch(e => { console.error('Could not start:', e.message); process.exit(1); });
}
