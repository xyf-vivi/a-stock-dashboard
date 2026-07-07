const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
const cands=['资金净流入','净申购额','ETF资金净流入','申购赎回净额','份额变化'];
for(const idx of cands){
  try{
    const r=wind('fund_data','get_fund_price_indicators',{windcode:'510300.SH',indexes:idx});
    const txt=r.slice(r.indexOf('"rows"'));
    console.log('['+idx+'] => '+txt.slice(0,160));
  }catch(e){ console.log('['+idx+'] ERR: '+e.message.slice(0,120)); }
}
