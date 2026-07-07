const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const e = data.data['2026-07-06'];

// 复制 classifyInnovativeDrug 口径
function cls(etf){
  const name = etf.name||''; const track = etf.trackIndex||''; const text = name+' '+track;
  if(/创新药|科创创新药|科创板创新药/i.test(text)) return 'coreInnov';
  if(/生物医药|医药卫生|医疗器械|医疗|CXO|生物科技|中药/i.test(text)) return 'growthMed';
  if(/医药/i.test(text) && !(/医药商业|医药流通/i.test(text))) return 'growthMed';
  return null;
}

const all=[];
for(const ck of Object.keys(e.etfTheme.categories))
  for(const tn of Object.keys(e.etfTheme.categories[ck].themes))
    for(const d of (e.etfTheme.categories[ck].themes[tn].etfDetails||[])){
      const c=cls(d); if(c) all.push({code:d.code,name:d.name,chg:d.chg,cls:c});
    }

const ABN=20;
const normal = all.filter(x=>!(x.chg!=null && Math.abs(x.chg)>ABN));
const abnormal = all.filter(x=>x.chg!=null && Math.abs(x.chg)>ABN);
const up = normal.filter(x=>x.chg>0).length;
const down = normal.filter(x=>x.chg<0).length;
const flat = normal.filter(x=>x.chg===0).length;

console.log('创新药/医药成长桶：');
console.log('  total etfs      =', all.length);
console.log('  normal (|chg|<=20%) =', normal.length, ' abnormal =', abnormal.length);
console.log('  up(chg>0)=',up,' down(chg<0)=',down,' flat(chg=0)=', flat);
console.log('  upRatio =', (up/normal.length).toFixed(4), '=>', (up/normal.length*100).toFixed(0)+'%');
console.log('  --- 每只 normal ETF ---');
normal.sort((a,b)=>b.chg-a.chg).forEach(x=>console.log('   ', x.code, x.name.slice(0,12).padEnd(12), 'chg=', x.chg));
