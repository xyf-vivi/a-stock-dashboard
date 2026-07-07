const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const e = data.data['2026-07-06'];
const tb = e.themeBreadth;
console.log('themeBreadth top keys:', tb ? Object.keys(tb) : 'NULL');
if (tb && Array.isArray(tb.themes)) {
  console.log('themes count:', tb.themes.length);
  console.log('themes[0] full JSON:', JSON.stringify(tb.themes[0]));
  console.log('all theme names:', tb.themes.map(t => t.name).join(', '));
}
// wind output
const wind = JSON.parse(fs.readFileSync('cache/breadth_margin_wind_0706.json', 'utf8'));
console.log('\nwind breadth count:', wind.breadth.length);
console.log('wind breadth[0]:', JSON.stringify(wind.breadth[0]));
console.log('wind names:', wind.breadth.map(b => b.name).join(', '));
