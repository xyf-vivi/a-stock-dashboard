const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if(!m){console.log('NO MATCH'); process.exit(1);}
const data = eval('('+m[1]+')');
console.log('top keys=', Object.keys(data));
console.log('dates=', data.dates);
const inner = data.data;
console.log('inner type=', typeof inner, 'keys=', inner ? Object.keys(inner).slice(0,5) : null);
const entry = inner && inner['2026-07-06'];
if(!entry){console.log('NO 2026-07-06 in inner'); console.log('inner sample keys=', inner?Object.keys(inner):null); process.exit(0);}
console.log('=== etfWide ===');
console.log('wide totalFlow =', entry.etfWide && entry.etfWide.totalFlow);
if(entry.etfWide && entry.etfWide.items) entry.etfWide.items.forEach(it=>console.log('  ', it.code, it.name, 'flow=', it.flow));
console.log('\n=== etfTheme meta ===');
console.log('date=', entry.etfTheme && entry.etfTheme.date);
if(entry.etfTheme) console.log('categories=', Object.keys(entry.etfTheme.categories));
const codes = new Set();
let themeCount=0, etfCount=0;
if(entry.etfTheme && entry.etfTheme.categories){
  for(const [ck,cat] of Object.entries(entry.etfTheme.categories)){
    let catSum=0;
    for(const [tn,th] of Object.entries(cat.themes||{})){
      themeCount++; catSum += (th.flow||0);
      (th.etfDetails||[]).forEach(e=>{ if(e.code){codes.add(e.code); etfCount++;} });
    }
    console.log('CAT', ck, 'cat.totalFlow=', cat.totalFlow, 'sum(theme.flow)=', catSum.toFixed(2));
  }
}
console.log('\n=== SUMMARY ===');
console.log('themeCount=', themeCount, 'etfDetail rows=', etfCount, 'unique codes=', codes.size);
console.log('CODES:', [...codes].join(','));
