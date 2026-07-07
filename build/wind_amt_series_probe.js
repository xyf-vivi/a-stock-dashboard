const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
function parse(raw){
  try{
    const j=JSON.parse(raw);
    let arr=null;
    if(Array.isArray(j.data)) arr=j.data;
    else if(j.metrics&&j.metrics[0]&&Array.isArray(j.metrics[0].data)) arr=j.metrics[0].data;
    else if(Array.isArray(j)) arr=j;
    if(!arr) return {raw:j};
    return arr.map(x=>({date:String(x.date||x.DATE||''), value:Number(x.value!=null?x.value:x.VALUE!=null?x.VALUE:NaN)}));
  }catch(e){ return {raw}; }
}
const ids=['ASHRMMFT','S4000018','M0064849','M0017129','M0014802','882011.WI'];
for(const id of ids){
  try{
    const r=wind('economic_data','get_economic_data',{metricIdsStr:id,beginDate:'20260605',endDate:'20260706'});
    const arr=parse(r);
    if(Array.isArray(arr)){
      console.log('=== '+id+' len='+arr.length+' 末3='+JSON.stringify(arr.slice(-3)));
    } else {
      console.log('=== '+id+' 非序列, raw='+JSON.stringify(arr.raw).slice(0,200));
    }
  }catch(e){ console.log('ERR '+id+': '+e.message.split('\n')[0].slice(0,160)); }
}
