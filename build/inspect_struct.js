const fs=require('fs'); const R=require('./src/render.js');
const html=fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const m=html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data=JSON.parse(m[1]);
const e=data.data['2026-07-06'];
const cache=JSON.parse(fs.readFileSync('cache/theme_flow_0706.json','utf8'));
for(const [ck,cat] of Object.entries(e.etfTheme.categories)){
  for(const [tn,th] of Object.entries(cat.themes)){
    let s=0,s5=0;
    for(const d of (th.etfDetails||[])){
      const c=cache[d.code];
      if(c&&c.ok){
        const r=c.shareT1>0?(c.shareT/c.shareT1):1;
        const sp=r>1.5||r<0.67;
        if(sp){d.flow=0;d.flow5d=0;d.shareChange=0;d.status='abnormal';d.splitAdjusted=true;d.nav=c.navT;}
        else {d.flow=c.flow;if(c.flow5!=null)d.flow5d=c.flow5;if(c.chg!=null)d.chg=c.chg;d.shareChange=+(c.shareT-c.shareT1).toFixed(2);d.status='confirmed';d.nav=c.navT;}
      }
      if(typeof d.flow==='number')s+=d.flow;
      if(typeof d.flow5d==='number')s5+=d.flow5d;
    }
    th.flow=+s.toFixed(4); if(s5)th.flow5d=+s5.toFixed(4);
  }
  let cs=0; for(const th of Object.values(cat.themes)) if(typeof th.flow==='number')cs+=th.flow;
  cat.totalFlow=+cs.toFixed(2);
}
e.etfTheme.date='2026-07-06';
const o=R.renderStructuralReview(data,'2026-07-06');
const txt=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
console.log('--- 资金性质链 ---');
let mm; const re=/chain-资金性质[\s\S]*?chain-value">([^<]*)[\s\S]*?chain-evidence">([\s\S]*?)<\/ul>/g;
while((mm=re.exec(o))) console.log('value:',txt(mm[1]),'| evidence:',txt(mm[2]));
console.log('--- 最大风险 ---');
const r2=/dc-risk[\s\S]*?dc-value">([^<]*)</.exec(o); if(r2) console.log(txt(r2[1]));
console.log('--- 里程碑(宽基/主题) ---');
const r3=/ms-desc">([^<]*宽基[^<]*)</.exec(o); if(r3) console.log(txt(r3[1]));
console.log('--- 明日验证/主线 ---');
const r4=/dc-mainline[\s\S]*?mainline-name">([^<]*)</.exec(o); if(r4) console.log('主线:',txt(r4[1]));
console.log('--- 是否还含 撤退/148/38.3 ---', o.includes('撤退'), o.includes('148'), o.includes('38.3'));
