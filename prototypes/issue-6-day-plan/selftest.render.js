// 原型自检：三个变体 + 全部面板的渲染烟雾扫描。用法 node selftest.render.js
const fs = require('fs');
const code = fs.readFileSync('index.prototype.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function mkEl(){ return { innerHTML:'', value:'', scrollTop:0, dataset:{}, classList:{add(){},remove(){},contains(){return false}},
  querySelector:()=>mkEl(), querySelectorAll:()=>[], appendChild(){}, setAttribute(){}, remove(){} }; }
const nodes = {};
global.document = { querySelector:(s)=>{ if(!nodes[s]) nodes[s]=mkEl(); return nodes[s]; }, querySelectorAll:()=>[], addEventListener(){}, createElement:mkEl };
global.window = {}; global.localStorage = { s:{}, getItem(k){return this.s[k]??null}, setItem(k,v){this.s[k]=v}, removeItem(k){delete this.s[k]} };
global.navigator = { clipboard:{ writeText(){} } }; global.alert = ()=>{};
new Function(code)();
const P = window.PROTOTYPE, M = P.model, S = () => P.state;
const main = () => document.querySelector('#main').innerHTML;
const modal = () => document.querySelector('#modal').innerHTML;
const topbar = () => document.querySelector('#topbar').innerHTML;
let bad = 0;
const ok2 = (n,c,x)=>{ if(!c){bad++;console.log("FAIL  "+n+"  "+(x===undefined?"":JSON.stringify(x)));} else console.log("pass  "+n); };
const scan = (label, html) => {
  const hits = [];
  if(/undefined/.test(html)) hits.push('undefined');
  if(/NaN/.test(html)) hits.push('NaN');
  if(/\[object Object\]/.test(html)) hits.push('[object Object]');
  if(html.length < 100) hits.push('too short: '+html.length);
  if(hits.length){ bad++; console.log('SUSPECT  '+label+'  ->  '+hits.join(', ')); }
  else console.log('clean    '+label+'  ('+html.length+' 字符)');
};

for (const [scen, name] of [['fresh','首次使用'],['empty','空状态'],['conflict','冲突场景']]) {
  M.seedScenario(scen);
for (const v of M.VARIANTS.map(x => x.k)) {
    P.ui.variant = v; P.ui.panel = null; P.ui.pending = null; M.render();
    scan(name+' / 变体 '+v+' / 主区', main());
    scan(name+' / 变体 '+v+' / 顶栏', topbar());
  }
}
// 面板
M.seedScenario('conflict');
for (const p of ['state','goals','batches','defaults','anchor','scenario','storage','add','edit']) {
  P.ui.panel = p; P.ui.sel = S().activities[0].id; M.render();
  scan('面板 '+p, modal());
}
// 重估预览
P.ui.panel = 'state';
P.ui.pending = { key:'wateringCan', value:'iridium', effectiveFrom:null,
  affected: M.previewStateChange('wateringCan','iridium',null), label:'喷壶等级 → 铱' };
M.render();
scan('重估预览', modal());

/* ===== 变体 D 的结构断言：包含→缩进、部分重叠→脊柱 + 同时进行标记 ===== */
function dHtml(){ P.ui.variant = 'D'; P.ui.panel = null; M.render(); return document.querySelector('#main').innerHTML; }
const cnt = (s, re) => (s.match(re) || []).length;
M.seedScenario('conflict');
S().gapMode = 'compact';    // 固定档位：紧凑档才会出现「已调整」空隙
let dh = dHtml();
ok2('D 冲突场景：卡片数 = 活动数', cnt(dh, /<div class="fcard(?!wrap)/g) === S().activities.length, [cnt(dh, /<div class="fcard(?!wrap)/g), S().activities.length]);
ok2('D 冲突场景：2 项被包含（缩进）', cnt(dh, /class="fcard[^"]*nested/g) === 2);
ok2('D 冲突场景：包含关系不产生脊柱', cnt(dh, /class="fcard[^"]*spine/g) === 0);
ok2('D 冲突场景：渲染出空隙留白（4 处）', (dh.split('<div class="fgap').length - 1) >= 3, (dh.split('<div class="fgap').length - 1));
ok2('D 已调整空隙改用悬停说明，正文不再出现实现语', /class="fgap adj"/.test(dh) && /title="真实时长/.test(dh) && !/已压缩/.test(dh));
ok2('D 包含标签方向正确：容器标「包含 X」', /包含 收获/.test(dh) && /包含 浇水/.test(dh));
ok2('D 包含标签方向正确：被包含者标「在 X 期间」', /在 木匠商店 期间/.test(dh) && /在 赶路 期间/.test(dh) && !/被 赶路 覆盖/.test(dh));
ok2('D 不再出现方向错误的「被包含于」', !/被包含于/.test(dh));
ok2('D 嵌套行不再重复父行时刻，改用 ↳ 且共 2 处', (dh.split('class="fgutter cont"').length - 1) === 2);
ok2('D 嵌套行起刻移入卡片内', dh.includes('<div class="ftitle"><span class="meta">'));
ok2('D 空隙是拖放落点', (dh.split('data-drop="gap"').length - 1) >= 3 && dh.includes('data-drops="'));
ok2('D 每张卡片都是拖放落点', (dh.split('data-drop="card"').length - 1) === S().activities.length);
M.seedScenario('fresh');
const s1 = M.newActivity('shop', 540);  s1.manualDuration = 60;
const s2 = M.newActivity('mining', 570); s2.manualDuration = 60;
dh = dHtml();
ok2('D 部分重叠：两者都进脊柱', cnt(dh, /class="fcard[^"]*spine/g) === 2);
ok2('D 部分重叠：出「同时进行」标记且报出重叠时长', cnt(dh, /class="fov"/g) === 1 && /同时进行 · 重叠 30m/.test(dh));
ok2('D 部分重叠：不误判为包含', cnt(dh, /class="fcard[^"]*nested/g) === 0);
M.seedScenario('fresh');
const g1 = M.newActivity('water', 360);  g1.manualDuration = 30;
const g2 = M.newActivity('harvest', 840); g2.manualDuration = 30;
dh = dHtml();
S().gapMode = 'compact';
dh = dHtml();
ok2('D 紧凑档：7h30m 空隙压到 30px 且标记为已调整', /class="fgap adj"/.test(dh) && dh.includes('style="height:30px"') && dh.includes('空闲 7h30m'));
S().gapMode = 'real';
dh = dHtml();
ok2('D 真实比例档：7h30m 空隙按比例渲染为 270px', dh.includes('style="height:270px"'));
ok2('D 真实比例档：不再标记为已调整', !/class="fgap adj"/.test(dh));
S().gapMode = 'real';
dh = dHtml();


/* ===== 只剩 D/E 两个变体，且空隙档位是分段开关 ===== */
const _src = fs.readFileSync('index.prototype.html', 'utf8');
ok2('变体为 D 与 F', M.VARIANTS.length === 2 && M.VARIANTS[0].k === 'D' && M.VARIANTS[1].k === 'F', M.VARIANTS.map(v => v.k));
ok2('两个变体时切换条可见', document.querySelector('#switcher').innerHTML.includes('data-act="variant"'));
ok2('源码里已无 E 的渲染与样式', !/renderE|eblock|enest|egap|eaxis|pxPerMin/.test(_src));
ok2('源码里已无 A/B/C 的渲染函数与专属样式', !/renderA|renderB|renderC|actrow|traycard|chipact/.test(_src), '残留命中');
M.seedScenario('conflict');
dh = dHtml();
ok2('空隙档位是两段开关（紧凑 / 真实比例）', dh.includes('class="seg"') && (dh.split('data-gapmode="').length - 1) === 2 && dh.includes('>紧凑<') && dh.includes('>真实比例<'));
ok2('当前档位按钮高亮（默认真实比例）', dh.includes('data-gapmode="real" class="on"'));
ok2('提示文案说明三种落点语义', dh.includes('紧贴到它前面') && dh.includes('紧贴到它后面') && dh.includes('移到该空闲时段起点'));


/* ===== 变体 F：左信息栏只列「本日真的用到」的状态 ===== */
function fHtml(){ P.ui.variant = 'F'; P.ui.panel = null; M.render(); return document.querySelector('#main').innerHTML; }
M.seedScenario('conflict');
let fh = fHtml();
const left = fh.split('class="fleft"')[1].split('<div class="col grow"')[0];
ok2('F：存在独立的左信息栏', fh.includes('class="fleft"') && left.length > 200, left.length);
ok2('F：左栏列出本日用到的状态（喷壶/钥匙/施工/度假村）', ['喷壶等级','城镇钥匙','罗宾正在农场施工','姜岛度假村已解锁'].every(x => left.includes(x)));
ok2('F：左栏不列本日没被任何活动依赖的状态（社区中心/背包空位）', !left.includes('社区中心状态') && !left.includes('背包至少一个空位'));
ok2('F：每个状态带一句后果', left.includes('项浇水按工作量估算'));
ok2('F：门店结论聚合进「今日检查」', left.includes('今日检查') && left.includes('木匠商店'));
ok2('F：左栏状态改动默认自带生效日期', (fh.split('data-plain="1"').length - 1) >= 1);
ok2('F：有空隙档位开关与添加入口', fh.includes('data-gapmode="compact"') && fh.includes('data-act="quickadd"'));
ok2('F：有收起左栏的开关', fh.includes('data-act="lefttoggle"'));
ok2('F：日程列与 D 共用同一套渲染', (fh.split('<div class="fgap').length - 1) >= 3 && fh.includes('<div class="fcard'));
const tb = document.querySelector('#topbar').innerHTML;
ok2('F：顶部栏让位，不再重复模式/天气/特殊日', !tb.includes('data-global="mode"') && !tb.includes('data-global="weather"'));
ok2('F：顶部栏仍保留日期导航与面板入口', tb.includes('shiftview') && tb.includes('data-p="defaults"'));
P.ui.leftCollapsed = true; fh = fHtml();
ok2('F：左栏可收起为窄条', fh.includes('class="fleft collapsed"'));
P.ui.leftCollapsed = false;
P.ui.variant = 'D'; M.render();   // fHtml() 内部会把变体设回 F，所以这里直接 render
ok2('D：顶部栏仍保留模式/天气/特殊日', document.querySelector('#topbar').innerHTML.includes('data-global="mode"'));


/* ===== 变体解耦：不得按变体名做逻辑分支；共用能力必须自动生效 ===== */
ok2('源码里没有任何 ui.variant 的相等/不等判断（逻辑不得按变体名分支）', !/ui\.variant\s*[!=]==?/.test(_src));
for (const v of M.VARIANTS.map(x => x.k)) {
  P.ui.variant = v; P.ui.panel = null; M.render();
  const vh = document.querySelector('#main').innerHTML;
  if (vh.includes('class="fcard')) {
    ok2('变体 ' + v + '：每张融合卡片都是拖放目标', (vh.split('data-dropid="').length - 1) === S().activities.length, [v, (vh.split('data-dropid="').length - 1), S().activities.length]);
    ok2('变体 ' + v + '：每张卡片都带拖放落点类型（gap/card）', vh.includes('data-drop="card"') && (vh.split('data-drop="gap"').length - 1) >= 1);
  }
}
P.ui.variant = 'F';

console.log(bad? '\n== '+bad+' 处可疑 ==' : '\n== 渲染烟雾测试全部干净 ==');
process.exit(bad?1:0);
