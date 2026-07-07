const {execFileSync}=require('child_process');
const SKILL='C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
// 用 westock MCP 需走 DeferExecuteTool，这里改用 node 直接调用 westock? 无本地cli，改用 fetch 不行。
// 改用：通过已验证的 westock data_fund_flow，但需要 MCP 调用。这里用脚本生成 codes 列表供手动核对。
const map={'上证50':'sh510050','沪深300':'sh510300','中证500':'sh510500','中证1000':'sh512100','中证A500':'sh563360','科创50':'sh588000','创业板指':'sz159915','创业板50':'sz159949','中证2000':'sh563300','科创100':'sh588030','深证100':'sz159901'};
console.log('codes='+Object.values(map).join(','));
