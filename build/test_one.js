const { execFileSync } = require('child_process');
const WIND='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function callWind(server, tool, params){
  try{
    const out = execFileSync('node',[WIND+'/scripts/cli.mjs','call',server,tool,JSON.stringify(params)],{cwd:WIND,encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
    const r=JSON.parse(out);
    if(r.isError){console.error('ERR',JSON.stringify(r.error||r).slice(0,300));return null;}
    if(r.content&&r.content[0]&&r.content[0].text) return JSON.parse(r.content[0].text);
    return r;
  }catch(e){console.error('CALLFAIL',e.message.slice(0,200));return null;}
}
const code='515050.OF'; // 5G通信ETF 科技成长
const q='查询'+code+'从20260702到20260706每日基金份额、单位净值、基金规模';
const d=callWind('analytics_data','get_financial_data',{question:q,lang:'中文'});
console.log('RAW:', JSON.stringify(d).slice(0,1500));
