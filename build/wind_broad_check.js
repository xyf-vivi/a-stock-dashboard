const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
const map={'上证50':'510050.SH','沪深300':'510300.SH','中证500':'510500.SH','中证1000':'512100.SH','中证A500':'563360.SH','科创50':'588000.SH','创业板指':'159915.SZ','创业板50':'159949.SZ','中证2000':'563300.SH','科创100':'588030.SH','深证100':'159901.SZ'};
let sum=0;
for(const [name,code] of Object.entries(map)){
  try{
    const r=wind('fund_data','get_fund_price_indicators',{windcode:code,indexes:'当日主力净流入额'});
    const j=JSON.parse(r);
    const rows=j.content[0].text;
    const obj=JSON.parse(rows);
    const ri=obj.data.columns.findIndex(c=>c.name==='当日主力净流入额');
    const val=parseFloat(obj.data.rows[0][ri]);
    const yi=val/1e8;
    sum+=yi;
    console.log(name+'('+code+'): '+(isFinite(yi)?yi.toFixed(2):'?')+'亿');
  }catch(e){ console.log(name+' ERR '+e.message.slice(0,80)); }
}
console.log('\nWind宽基11只 当日主力净流入额 求和(亿):', sum.toFixed(2));
console.log('已知07-06真实宽基申赎净流: -6.957');
console.log('吻合(差<3)?', Math.abs(sum-(-6.957))<3 ? '是→Wind当前=07-06数据，可用' : '否→口径/日期不符');
