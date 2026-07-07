const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
for(const code of ['510300.SH','159915.SZ']){
  try{
    const r=wind('fund_data','get_fund_price_indicators',{windcode:code,indexes:'中文简称,基金最新份额,基金规模,IOPV,当日主力净流入额,近5日主力净流入额'});
    console.log('=== '+code+' ===');
    console.log(r.slice(0,800));
    console.log('');
  }catch(e){ console.log('ERR '+code+': '+e.message.slice(0,300)); }
}
