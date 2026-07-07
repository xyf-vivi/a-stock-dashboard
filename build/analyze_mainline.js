const fs=require('fs');
const R=require('./src/render.js');
const html=fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const m=html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data=JSON.parse(m[1]);
const dt='2026-07-06';
const entry=data.data[dt];
const wma=data.weeklyMA34||{};

const leaders=R.buildThemeLeaderBoard(entry,data,dt,wma);
console.log('=== 07-06 真实主题综合评分榜（按 score 降序）===');
leaders.forEach((l,i)=>{
  console.log(
    String(i+1).padStart(2), l.name.padEnd(14),
    'score='+l.score.toFixed(1).padStart(5),
    'type='+l.leaderType.padEnd(6),
    'chg='+(l.medianChg!=null?l.medianChg.toFixed(2):'--').padStart(6),
    'flowDay='+(l.flowDay!=null?l.flowDay.toFixed(2):'--').padStart(7),
    'flow5d='+(l.flow5d!=null?l.flow5d.toFixed(2):'--').padStart(7),
    'upRatio='+(l.upRatio!=null?(l.upRatio*100).toFixed(0)+'%':'--').padStart(4),
    'n='+(l.normalCount||0)
  );
});

// replicate canEnterFormalMainline gate (coverageRatio>=0.6, missingFields<2)
function coverageRatio(n){ return n>=5?1.0:(n>=3?0.8:(n>=1?0.4:0)); }
console.log('\n=== 进入正式主线候选门控（top5 by score）===');
const top5=leaders.slice(0,5).filter(l=>l.score>0);
top5.forEach(l=>{
  const cr=coverageRatio(l.normalCount||0);
  const pass = cr>=0.6;
  console.log(l.name.padEnd(14),'coverageRatio='+cr,'passFormal='+pass);
});
console.log('\n=== 实际展示的正式主线候选（formalMainline.slice(0,3)）===');
top5.filter(l=>coverageRatio(l.normalCount||0)>=0.6).slice(0,3).forEach((l,i)=>{
  console.log((i+1)+'.', l.name, l.leaderType, 'score='+l.score.toFixed(1));
});

// 创新药定位
const innov=leaders.find(l=>l.name==='创新药/医药成长');
if(innov){
  const idx=leaders.indexOf(innov);
  console.log('\n=== 创新药/医药成长 ===');
  console.log('在全榜排名:', idx+1, '/', leaders.length);
  console.log('是否在前5 score:', idx<5);
  console.log('score=',innov.score,'type=',innov.leaderType,
    'chg=',innov.medianChg,'flowDay=',innov.flowDay,'flow5d=',innov.flow5d,'upRatio=',innov.upRatio,'n=',innov.normalCount);
}
