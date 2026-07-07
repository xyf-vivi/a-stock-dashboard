const fs=require('fs');
const R=require('./src/render.js');
const html=fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const m=html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data=JSON.parse(m[1]);
const dt='2026-07-06';
const entry=data.data[dt];
const cache=JSON.parse(fs.readFileSync('cache/theme_flow_0706.json','utf8'));

const innov=R.buildInnovativeDrugBucket(entry);
console.log('创新药桶 etfCount=',innov.etfCount,'normalCount=',innov.normalCount);
let sumDay=0,sum5=0,sumChg=0,chgN=0,okN=0;
const rows=[];
innov.etfs.forEach(e=>{
  const c=cache[e.code];
  const day=c&&c.ok?c.flow:null;
  const f5=c&&c.ok?c.flow5:null;
  const ch=c&&c.ok?c.chg:null;
  if(c&&c.ok)okN++;
  if(day!=null)sumDay+=day;
  if(f5!=null)sum5+=f5;
  if(ch!=null){sumChg+=ch;chgN++;}
  rows.push({code:e.code,name:e.name,day,f5,ch,nav:c&&c.navT,ratio:c&&c.shareT1>0?(c.shareT/c.shareT1).toFixed(2):'-',ok:c&&c.ok});
});
console.log('缓存汇总: flowDay=',sumDay.toFixed(2),'flow5d=',sum5.toFixed(2),'medianChg(n='+chgN+')=',(sumChg/chgN).toFixed(2));
console.log('桶自身(buildIndustryEtfBuckets口径): flowDay=',innov.flowDay,'flow5d=',innov.flow5d,'medianChg=',innov.medianChg,'upRatio=',innov.upRatio);
console.log('\n明细:');
rows.forEach(r=>console.log(r.code,r.name,'day='+r.day,'f5='+r.f5,'chg='+r.chg,'ratio='+r.ratio,'ok='+r.ok));
