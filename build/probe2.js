const fs=require('fs');
const html=fs.readFileSync('output/fused_dashboard_v2.html','utf8');
const re=/<script[\s\S]*?<\/script>/g; const inS=[]; let m;
while((m=re.exec(html))) inS.push([m.index,m.index+m[0].length]);
const inScriptAt=i=>inS.some(([a,b])=>i>=a&&i<b);
const ids=["tab-structural","tab-review","tab-structure","tab-capital","tab-etf","tab-quality","tab-validate"];
for(const id of ids){
  const r=new RegExp('<div[^>]*\\bid="'+id+'"','g'); let mm,c=0,real=0,firstReal=-1;
  while((mm=r.exec(html))){ c++; if(!inScriptAt(mm.index)){ real++; if(firstReal<0) firstReal=mm.index; } }
  console.log(id,'total',c,'real',real,'firstRealIdx',firstReal);
}
