const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
try{
  const r=wind('fund_data','get_fund_kline',{windcode:'510300.SH',begin_date:'20260701',end_date:'20260706'});
  console.log(r.slice(0,1500));
}catch(e){ console.log('ERR: '+e.message.slice(0,400)); }
