const fs=require('fs');
const R=require('./src/render.js');
const WRITE=process.env.WRITE==='1';
const F='output/fused_dashboard_v2.html';
const html=fs.readFileSync(F,'utf8');
const m=html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if(!m){console.error('no DASHBOARD_DATA');process.exit(1);}
const data=JSON.parse(m[1]);
const DT='2026-07-06';
const e=data.data[DT];
const cache=JSON.parse(fs.readFileSync('cache/theme_flow_0706.json','utf8'));

// ---- patch etfTheme with real 07-06 share-based flows ----
let patched=0, splits=0, missing=0; const splitCodes=[];
for(const [ck,cat] of Object.entries(e.etfTheme.categories)){
  for(const [tn,th] of Object.entries(cat.themes)){
    let sum=0, sum5=0;
    for(const d of (th.etfDetails||[])){
      const c=cache[d.code];
      if(c&&c.ok){
        const ratio=c.shareT1>0?(c.shareT/c.shareT1):1;
        const isSplit = ratio>1.5 || ratio<0.67;
        if(isSplit){ splits++; splitCodes.push(d.code);
          d.flow=0; d.flow5d=0; d.shareChange=0; d.sharePending=false; d.status='abnormal'; d.splitAdjusted=true; d.nav=c.navT;
        } else {
          d.flow=c.flow; if(c.flow5!=null)d.flow5d=c.flow5; if(c.chg!=null)d.chg=c.chg;
          d.shareChange=+(c.shareT-c.shareT1).toFixed(2); d.sharePending=false; d.status='confirmed'; d.nav=c.navT; patched++;
        }
      } else missing++;
      if(typeof d.flow==='number') sum+=d.flow;
      if(typeof d.flow5d==='number') sum5+=d.flow5d;
    }
    th.flow=+sum.toFixed(4);
    if(sum5) th.flow5d=+sum5.toFixed(4);
  }
  let csum=0; for(const th of Object.values(cat.themes)) if(typeof th.flow==='number') csum+=th.flow;
  cat.totalFlow=+csum.toFixed(2);
}
e.etfTheme.date=DT;
let grand=0; for(const [ck,cat] of Object.entries(e.etfTheme.categories)){ let s=0; for(const th of Object.values(cat.themes)) s+=th.flow||0; grand+=s; }
console.log('patched=',patched,'splits=',splits,splitCodes,'missing=',missing,'THEME TOTAL=',grand.toFixed(2),'WIDE=',e.etfWide.totalFlow);

// ---- locate the single populated static tab (tab-structural) ----
const TAB_ID='tab-structural';
const openRe=new RegExp('<div[^>]*\\bid="'+TAB_ID+'"');
const om=html.match(openRe);
if(!om){console.error('tab-structural opening not found');process.exit(1);}
const openIdx=om.index;
const tagLen=om[0].length;

// stack-scan for matching </div>, skipping <script> blocks
function findDivClose(s, start){
  let depth=1, i=start;
  while(i<s.length){
    if(s.startsWith('<script',i)){ const j=s.indexOf('</script>',i); i = j<0? s.length : j+9; continue; }
    if(s.startsWith('</div>',i)){ depth--; if(depth===0) return i+6; i+=6; continue; }
    if(s.startsWith('<div',i)){ depth++; i+=4; continue; }
    i++;
  }
  throw new Error('unbalanced div from '+start);
}
const closeEnd=findDivClose(html, openIdx+tagLen);
console.log('structural open@',openIdx,'closeEnd@',closeEnd,'len',closeEnd-openIdx);

const newTab=R.renderStructuralReview(data,DT);
console.log('rendered structural includes id?', newTab.includes('id="tab-structural"'),
  '| 148亿?', newTab.includes('148亿'), '| 38.3亿?', newTab.includes('38.3亿'));
// show headline / risk tone from re-render
const toneM=newTab.match(/dc-value">(资金[^<]*)/); if(toneM) console.log('re-render 资金性质:', toneM[1]);
const riskM=newTab.match(/dc-value">([^<]*资金[^<]*)/); if(riskM) console.log('re-render 最大风险:', riskM[1]);

if(!WRITE){
  console.log('[DRY-RUN] no file written');
  process.exit(0);
}

// ---- write: replace static structural block + DASHBOARD_DATA JSON ----
const before=html.slice(0,openIdx);
const after=html.slice(closeEnd);
const newBody=before+newTab+after;
const newDataStr=JSON.stringify(data);
const finalHtml=newBody.replace(/var DASHBOARD_DATA = [\s\S]*?;\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = '+newDataStr+';\nvar CURRENT_DATE');
fs.writeFileSync(F, finalHtml, 'utf8');
console.log('WROTE', F, (finalHtml.length/1024).toFixed(0),'KB');
