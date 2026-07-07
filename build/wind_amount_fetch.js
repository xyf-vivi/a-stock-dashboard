const {execFileSync}=require('child_process');
const fs=require('fs');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
function wind(server,tool,params){
  const ps=JSON.stringify(params);
  return execFileSync(process.execPath,['scripts/cli.mjs','call',server,tool,ps],{cwd:SKILL,encoding:'utf8',maxBuffer:1e8});
}
function parseAmount(raw){
  // 尝试解析 Wind EDB 返回，取最后一条(最近日期)
  try{
    const j=JSON.parse(raw);
    // 常见结构: {data:[{date,value}...]} 或 {metrics:[{id,data:[{date,value}]}]}
    let arr=null;
    if(Array.isArray(j.data)) arr=j.data;
    else if(j.metrics&&j.metrics[0]&&Array.isArray(j.metrics[0].data)) arr=j.metrics[0].data;
    else if(Array.isArray(j)) arr=j;
    if(!arr) return {raw:j};
    return arr.map(x=>({date:String(x.date||x.DATE||''), value:Number(x.value!=null?x.value:x.VALUE!=null?x.VALUE:x.close!=null?x.close:NaN)}));
  }catch(e){ return {raw}; }
}
const ids=['ASHRMMFT','M0014801'];
for(const id of ids){
  try{
    const r=wind('economic_data','get_economic_data',{metricIdsStr:id,beginDate:'20260601',endDate:'20260706'});
    const arr=parseAmount(r);
    if(Array.isArray(arr)){
      console.log('=== '+id+' 序列长度='+arr.length+' 单位疑似元 ===');
      console.log('最后3条:', JSON.stringify(arr.slice(-3)));
      const last=arr[arr.length-1];
      console.log('最近交易日='+last.date+' 值(元)='+last.value+' → 亿='+(last.value/1e8).toFixed(0));
    } else {
      console.log('=== '+id+' 无法解析 ===');
      console.log('raw:', JSON.stringify(arr.raw).slice(0,500));
    }
  }catch(e){ console.log('ERR '+id+': '+e.message.slice(0,300)); }
}
