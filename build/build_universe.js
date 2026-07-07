// Build canonical 11-bucket universe -> W/build/universe_20260706.json
const fs = require('fs');
const SRC_POOL = 'D:/workboddy/2026-07-03-11-32-09/theme_pool_built.json';
const OUT = 'D:/workboddy/2026-07-06-20-08-50/build/universe_20260706.json';
const pool = JSON.parse(fs.readFileSync(SRC_POOL, 'utf8')).pool;

function wsCode(c) {
  const m = /^(\d{6})\.(SH|SZ)$/.exec(c);
  if (!m) return c;
  return (m[2] === 'SH' ? 'sh' : 'sz') + m[1];
}

const bucketMap = {};
for (const [bucket, list] of Object.entries(pool)) {
  for (const e of list) bucketMap[e.code] = { bucket, role: e.fromWhitelist ? 'whitelist' : 'wind' };
}
for (const code of Object.keys(bucketMap)) {
  if (bucketMap[code].bucket === '资源周期') bucketMap[code].bucket = '有色资源';
}
const additions = [
  { code: '563300.SH', bucket: '微盘小票', role: 'proxy' },
  { code: '159628.SZ', bucket: '微盘小票', role: 'proxy' },
  { code: '159531.SZ', bucket: '微盘小票', role: 'proxy' },
  { code: '159828.SZ', bucket: '医药成长扩展', role: 'ext' },
  { code: '159883.SZ', bucket: '医药成长扩展', role: 'ext' },
  { code: '561510.SH', bucket: '医药成长扩展', role: 'ext' }
];
for (const a of additions) bucketMap[a.code] = { bucket: a.bucket, role: a.role };

const BUCKETS = ['科技成长','创新药核心','医药成长扩展','证券金融','红利防御','消费价值','有色资源','化工','新能源','军工','传媒游戏','微盘小票'];
const universe = [];
for (const [code, info] of Object.entries(bucketMap)) {
  universe.push({ code, codeWs: wsCode(code), bucket: info.bucket, role: info.role });
}
universe.sort((a,b)=> BUCKETS.indexOf(a.bucket)-BUCKETS.indexOf(b.bucket) || a.code.localeCompare(b.code));

const byBucket = {};
for (const u of universe) byBucket[u.bucket] = (byBucket[u.bucket]||0)+1;
fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString(), total: universe.length, byBucket, universe }, null, 2));
console.log('TOTAL:', universe.length);
for (const b of BUCKETS) console.log('  '+b+': '+(byBucket[b]||0));
console.log('ROLES:', JSON.stringify(universe.reduce((m,u)=>{m[u.role]=(m[u.role]||0)+1;return m;},{})));
console.log('CODES:', universe.map(u=>u.codeWs).join(','));
