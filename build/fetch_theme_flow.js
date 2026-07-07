const fs=require('fs');
const { execFileSync } = require('child_process');
const WIND='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';

// 1) collect 98 theme ETF codes from HTML
const html=fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const m=html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data=eval('('+m[1]+')');
const e=data.data['2026-07-06'];
const codes=new Set();
for(const cat of Object.values(e.etfTheme.categories))
  for(const th of Object.values(cat.themes))
    for(const d of (th.etfDetails||[])) if(d.code) codes.add(d.code);
const list=[...codes];
console.log('total codes=',list.length);

// 2) cache file (incremental)
const cachePath='cache/theme_flow_0706.json';
let cache={};
if(fs.existsSync(cachePath)){ try{cache=JSON.parse(fs.readFileSync(cachePath,'utf8'));}catch(_){cache={};} }

function callWind(code){
  const q='查询'+code+'从20260626到20260706每日基金份额、单位净值、基金规模';
  try{
    const out=execFileSync('node',[WIND+'/scripts/cli.mjs','call','analytics_data','get_financial_data',JSON.stringify({question:q,lang:'中文'})],{cwd:WIND,encoding:'utf8',timeout:60000,maxBuffer:30*1024*1024});
    const r=JSON.parse(out);
    if(r.isError) return {err:JSON.stringify(r.error||r).slice(0,200)};
    const blk=(r.content&&r.content[0]&&r.content[0].text)?JSON.parse(r.content[0].text):r;
    const tbl=blk.data&&blk.data.data&&blk.data.data[0];
    if(!tbl||!tbl.rows||!tbl.rows.length) return {err:'no rows'};
    const cols=tbl.columns;
    // locate column indexes
    const ci={}; cols.forEach((c,i)=>{ const n=c.name; if(n.indexOf('基金份额')>=0&&n.indexOf('时间')<0) ci.share=i; if(n.indexOf('单位净值')>=0&&n.indexOf('时间')<0&&n.indexOf('币种')<0) ci.nav=i; if(n.indexOf('基金规模')>=0&&n.indexOf('时间')<0) ci.size=i; if(n.indexOf('基金份额时间')>=0) ci.shareT=i; if(n.indexOf('单位净值时间')>=0) ci.navT=i; });
    const series={};
    tbl.rows.forEach(row=>{
      const ds=String(row[ci.shareT]||row[ci.navT]||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1$2$3').replace(/\D/g,'');
      if(ds.length!==8) return;
      series[ds]={ share:parseFloat(row[ci.share]), nav:parseFloat(row[ci.nav]), fundSize:parseFloat(row[ci.size]) };
    });
    return {series};
  }catch(err){ return {err:err.message.slice(0,200)}; }
}

function calcFlow(series){
  const T='20260706';
  const ks=Object.keys(series).filter(k=>k<=T).sort();
  if(!ks.length) return null;
  const tIdx=ks.indexOf(T);
  const tKey=tIdx>=0?T:ks[ks.length-1];
  const t1=ks[ks.indexOf(tKey)-1];
  if(t1==null) return null;
  const sT=series[tKey], sT1=series[t1];
  if(sT.share==null||sT1.share==null||sT.nav==null) return null;
  const flow=(sT.share-sT1.share)*sT.nav/10000;
  // 5d: trading days from (tKey-5)..tKey
  const startIdx=Math.max(0,ks.indexOf(tKey)-5);
  let flow5=0,ok5=true;
  for(let i=startIdx+1;i<=ks.indexOf(tKey);i++){
    const a=series[ks[i-1]],b=series[ks[i]];
    if(a&&b&&a.share!=null&&b.share!=null&&b.nav!=null) flow5+=(b.share-a.share)*b.nav/10000; else ok5=false;
  }
  const chg=(sT1.nav&&sT1.nav!==0)?(sT.nav-sT1.nav)/sT1.nav*100:null;
  return { flow:+flow.toFixed(4), flow5:ok5?+flow5.toFixed(4):null, chg:chg!=null?+chg.toFixed(2):null, shareT:sT.share, shareT1:sT1.share, navT:sT.nav, tKey, t1 };
}

let done=0, fail=0;
for(const raw of list){
  const ofc=raw.replace(/\.(SH|SZ)$/,'.OF');
  if(cache[raw]&&cache[raw].flow!=null){ done++; continue; }
  let res=callWind(ofc);
  if(res.err){ // retry once
    res=callWind(ofc);
  }
  if(res.err){ cache[raw]={ok:false,err:res.err}; fail++; }
  else { const f=calcFlow(res.series); if(f){cache[raw]=Object.assign({ok:true,code:raw},f);} else {cache[raw]={ok:false,err:'calc null'};fail++;} done++; }
  fs.writeFileSync(cachePath,JSON.stringify(cache,null,1));
  if((done+fail)%10===0) console.log('progress',done+fail,'/',list.length);
}
console.log('DONE. ok=',done,'fail=',fail,'cache=',cachePath);
