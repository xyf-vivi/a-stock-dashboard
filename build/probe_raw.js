const fs=require('fs');
const raw=JSON.parse(fs.readFileSync('data/rawData_local.json','utf8'));
console.log('raw top keys=', Object.keys(raw).slice(0,10));
// find 07-06
let d = raw['2026-07-06'] || (raw.data && raw.data['2026-07-06']) || null;
if(!d){ // maybe raw is array or has dates
  console.log('no direct. raw sample type', typeof raw, Array.isArray(raw));
  if(Array.isArray(raw)){ console.log('array len', raw.length); console.log('first keys', Object.keys(raw[0]||{})); }
  process.exit(0);
}
console.log('07-06 keys=', Object.keys(d));
if(d.etfWide){ console.log('etfWide=', JSON.stringify(d.etfWide).slice(0,800)); }
if(d.wideTotal!==undefined) console.log('wideTotal=', d.wideTotal);
