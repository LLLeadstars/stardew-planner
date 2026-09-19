// 原型自检：模型层断言。用法 node selftest.model.js
const fs = require('fs');
const html = fs.readFileSync('index.prototype.html', 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
const dummy = new Proxy(function(){}, {
  get(t,k){
    if(k==='classList') return {add(){},remove(){},contains(){return false}};
    if(k==='querySelectorAll') return ()=>[];
    if(k==='querySelector') return ()=>dummy;
    if(k==='value') return ''; if(k==='dataset') return {}; if(k==='innerHTML') return '';
    return dummy;
  }, set(){return true}, apply(){return dummy}
});
global.document = { querySelector:()=>dummy, querySelectorAll:()=>[], addEventListener(){}, createElement:()=>dummy };
global.window = {};
global.localStorage = { s:{}, getItem(k){return this.s[k]??null}, setItem(k,v){this.s[k]=v}, removeItem(k){delete this.s[k]} };
global.navigator = { clipboard:{ writeText(){} } };
global.alert = () => {};
new Function(code)();
const P = window.PROTOTYPE, M = P.model, S = () => P.state;
let fails = 0;
const ok = (n,c,x) => { if(!c){fails++;console.log('FAIL  '+n+'  '+(x===undefined?'':JSON.stringify(x)));} else console.log('pass  '+n); };

/* 日期 / 星期 / 时间 */
ok('春1 = 周一', M.weekdayOf({year:1,season:0,day:1})===0);
ok('春9 = 周二', M.weekdayOf({year:1,season:0,day:9})===1);
ok('春2 = 周二', M.weekdayOf({year:1,season:0,day:2})===1);
ok('春28+1 = 夏1', M.dkey(M.addDays({year:1,season:0,day:28},1))==='1-1-1');
ok('冬28+1 = 第2年春1', M.dkey(M.addDays({year:1,season:3,day:28},1))==='2-0-1');
ok('tmin 00:20 = 1460（次日）', M.tmin('00:20')===1460);
ok('fmtT 1460 = 次日 00:20', M.fmtT(1460)==='次日 00:20');
ok('fmtDur 90 = 1h30m', M.fmtDur(90)==='1h30m');

/* 首次使用 / 空状态 */
M.seedScenario('fresh');
ok('首次使用：无活动无目标', S().activities.length===0 && S().goals.length===0);
ok('首次使用：喷壶=基础、社区中心=未知', S().playerState.wateringCan.value==='basic' && S().playerState.communityCenter.value==='unknown');
M.seedScenario('empty');
ok('空状态：有目标无活动', S().goals.length===1 && S().activities.length===0);

/* 时长来源优先级链 */
M.seedScenario('fresh');
ok('无默认 → 系统推荐预留', M.priorityDuration('harvest').source==='system' && M.priorityDuration('harvest').minutes===60);
S().personalDefaults.harvest = 75;
ok('个人默认 > 系统推荐', M.priorityDuration('harvest').source==='personal');
delete S().personalDefaults.harvest;
S().lastReserved.harvest = {minutes:45, date:'春1'};
ok('最近一次 > 系统推荐', M.priorityDuration('harvest').source==='last' && M.priorityDuration('harvest').minutes===45);
S().personalDefaults.harvest = 75;
ok('个人默认 > 最近一次', M.priorityDuration('harvest').minutes===75);
delete S().personalDefaults.harvest;

/* 浇水工作量估算与降级 */
const w = M.newActivity('water', 360);
S().playerState.wateringCan.value='copper';
w.workload = {tiles:40, density:'normal'};
let e = M.estimateWater(w);
ok('40格/普通/铜壶 = 20分', e.ok && e.minutes===20, e.minutes);
w.workload.tiles=130;
ok('130格超校准上界 → 降级', !M.estimateWater(w).ok && /超出校准上界/.test(M.estimateWater(w).reasons.join('')));
w.workload.tiles=40; S().mode='multi';
ok('多人模式 → 降级（未校准）', !M.estimateWater(w).ok);
S().mode='single';
w.workload.density='scattered';
ok('分散系数抬高估算', M.estimateWater(w).minutes===30, M.estimateWater(w).minutes);
w.workload.density='normal'; w.workload.tiles=100;
ok('100格/铜壶 → 1 次补水，估算 60 分（按 10 分钟取整）', (()=>{const x=M.estimateWater(w); return x.minutes===60 && x.breakdown.some(b=>b.v.indexOf('1 次')>=0);})(), M.estimateWater(w));
w.workload.tiles=200;
ok('超范围时 actTime 走预留链而非估算', ['system','personal','last'].includes(M.actTime(w).source));
M.setDuration(w.id, 33);
ok('时长遵守 10 分钟粒度（33 → 30）', M.actTime(w).minutes===30, M.actTime(w));
ok('手填后来源 = 手填', M.actTime(w).source==='manual');
ok('手填写入「最近一次预留」', S().lastReserved.water && S().lastReserved.water.minutes===30, S().lastReserved.water);
ok('手填不改动个人默认', S().personalDefaults.water===undefined);
w.workload.tiles=40;
ok('改工作量参数不清掉手填（保留供对照）', M.actTime(w).source==='manual');


/* 冲突组 / 空闲 / 超出游戏日 */
M.seedScenario('conflict');
const info = M.layoutInfo();
ok('冲突场景产生冲突组', info.conflicts.length>=1, info.conflicts.length);
ok('重叠活动被分到不同泳道', Object.values(info.layout).some(l=>l.lanes>1));
const gaps = M.freeGaps();
ok('空闲时段存在', gaps.length>0);
ok('空闲区不含任何活动占用', gaps.every(g=>S().activities.every(a=>{const r=M.actRange(a); return !(r.s<g.e && g.s<r.e);})));
const ovr = M.overrun();
ok('超出游戏日：01:30 钓鱼 120m → 超 90m', ovr.length===1 && ovr[0].over===90, ovr.map(o=>[o.a.type,o.over]));
const shop = S().activities.find(x=>x.type==='shop');
ok('手填 90 分的木匠店来源=手填', M.actTime(shop).source==='manual' && M.actTime(shop).minutes===90);
const doneAct = S().activities.find(x=>x.done);
ok('已完成记录被保留', !!doneAct && doneAct.doneDate==='1-0-3', doneAct&&doneAct.doneDate);

/* ===== 门店判定：建筑可进入 与 服务可用 分开（#12 结论，依据门店矩阵 2026-09-18） ===== */
const D3 = { year: 1, season: 0, day: 3 };   // 春3 = 周三
const D2 = { year: 1, season: 0, day: 2 };   // 春2 = 周二
const D5 = { year: 1, season: 0, day: 5 };   // 春5 = 周五
const reset = () => { M.seedScenario('fresh'); S().weather = 'sunny'; S().specialDay = 'none'; };

// 皮埃尔：周三的开放条件是「社区中心完成 或 持有城镇钥匙」——钥匙分支是 #12 新增的规则
reset(); S().playerState.communityCenter.value = 'unknown'; S().playerState.keyToTown.value = 'unknown';
ok('皮埃尔周三：社区中心与钥匙都未知 → 保持未知', M.shopStatus('pierre', D3).service.level === 'unknown');
reset(); S().playerState.communityCenter.value = 'notRestored'; S().playerState.keyToTown.value = 'no';
ok('皮埃尔周三：未修复且无钥匙 → 不可用', M.shopStatus('pierre', D3).service.level === 'closed');
reset(); S().playerState.communityCenter.value = 'restored'; S().playerState.keyToTown.value = 'no';
ok('皮埃尔周三：社区中心完成 → 可用', M.shopStatus('pierre', D3).service.level === 'ok');
reset(); S().playerState.communityCenter.value = 'notRestored'; S().playerState.keyToTown.value = 'yes';
ok('皮埃尔周三：未修复但**持有城镇钥匙** → 可用（#12 修复的规则错误）', M.shopStatus('pierre', D3).service.level === 'ok');
reset(); S().playerState.communityCenter.value = 'unknown'; S().playerState.keyToTown.value = 'yes';
ok('皮埃尔周三：钥匙已持有 → 即使社区中心未知也可用', M.shopStatus('pierre', D3).service.level === 'ok');

// 两个维度确实不同：皮埃尔常态下可进到 21:00，但只能交易到 17:00
reset(); S().playerState.communityCenter.value = 'restored';   // 先给一个确定状态，否则周三的皮埃尔是未知、没有时段
const pierreNormal = M.shopStatus('pierre', D3);
ok('皮埃尔：可进入 与 可交易 的时段不同', pierreNormal.access.windows[0].s === 540 && pierreNormal.access.windows[0].e === 1260 &&
   pierreNormal.service.windows[0].s === 540 && pierreNormal.service.windows[0].e === 1020);

// 木匠店：施工时「能进但办不了事」——两维度分离最直观的一例
reset(); S().playerState.robinBuilding.value = 'yes';
const robinBuild = M.shopStatus('robin', D3);
ok('木匠店施工：服务关闭', robinBuild.service.level === 'closed' && !robinBuild.hasTip);
ok('木匠店施工：建筑仍可进入（两维度分离）', robinBuild.access.level === 'ok');

// 木匠店：周二 / 雨天 / 周五 16:00 / 夏 18 日
reset();
const robinTue = M.shopStatus('robin', D2);
ok('木匠店周二晴：服务关闭 + 两个技巧窗口', robinTue.service.level === 'closed' && robinTue.service.windows.filter(x => x.kind === 'tip').length === 2);
ok('木匠店周二：技巧不写成绿色营业段', !robinTue.service.windows.some(x => x.kind === 'ok'));
ok('木匠店周二：建筑仍可进入', robinTue.access.level === 'ok');
reset(); S().weather = 'rain';
const robinTueRain = M.shopStatus('robin', D2);
ok('木匠店周二雨：照常 09:00–17:00', robinTueRain.service.level === 'ok' && robinTueRain.service.windows[0].s === 540 && robinTueRain.service.windows[0].e === 1020);
reset();
const robinFri = M.shopStatus('robin', D5);
ok('木匠店周五：16:00 关店（#12 新增）', robinFri.service.windows[0].e === 960);
reset();
const robinSummer18 = M.shopStatus('robin', { year: 1, season: 1, day: 18 });
ok('木匠店夏 18 日：正式服务关闭', robinSummer18.service.level === 'closed');
ok('木匠店夏 18 日：约 17:50 有技巧窗口（#12 新增）', robinSummer18.service.windows.some(x => x.kind === 'tip' && x.s === 1070));
ok('木匠店夏 18 日：建筑仍可进入', robinSummer18.access.level === 'ok');

// 铁匠铺：周五分支 / 冬16 / 绿雨 / 春16 / 沙漠节 / 度假村
reset(); S().playerState.communityCenter.value = 'restored';
ok('铁匠铺周五晴（社区中心已修复）：Clint 不在店', M.shopStatus('clint', D5).service.level === 'closed');
reset(); S().playerState.communityCenter.value = 'restored'; S().weather = 'rain';
ok('铁匠铺周五雨：照常办理', M.shopStatus('clint', D5).service.level === 'ok');
reset(); S().playerState.communityCenter.value = 'unknown';
ok('铁匠铺周五（社区中心未知）：保持未知', M.shopStatus('clint', D5).service.level === 'unknown');
reset();
const clintWinter16 = M.shopStatus('clint', { year: 1, season: 3, day: 16 });
ok('铁匠铺冬 16 日：10:30 前办理', clintWinter16.service.windows[0].e === 630);
reset(); S().weather = 'greenRain';
ok('铁匠铺第 1 年绿雨：Clint 不在店内', M.shopStatus('clint', D5).service.level === 'closed');
reset();
ok('铁匠铺春 16 日：可能离店 → 保持未知（#12 新增）', M.shopStatus('clint', { year: 1, season: 0, day: 16 }).service.level === 'unknown');
reset(); S().specialDay = 'desertFestival';
ok('铁匠铺沙漠节：可能离店 → 保持未知（#12 新增）', M.shopStatus('clint', D3).service.level === 'unknown');
reset(); S().playerState.resortUnlocked.value = 'yes';
ok('铁匠铺周五 + 度假村已解锁：可能离店 → 保持未知', M.shopStatus('clint', D5).service.level === 'unknown');

// 特殊日：普通节日关闭；晚间／特殊节日按例外保持未知
reset(); S().specialDay = 'festival';
ok('普通节日：三家门店服务均关闭', ['pierre', 'robin', 'clint'].every(s => M.shopStatus(s, D3).service.level === 'closed'));
reset(); S().specialDay = 'eveningFestival';
ok('晚间／特殊节日：按资料例外保持未知，不写成确定关闭', ['pierre', 'robin', 'clint'].every(s => M.shopStatus(s, D3).service.level === 'unknown'));
reset(); S().specialDay = 'desertFestival';
ok('沙漠节：皮埃尔按例外保持未知', M.shopStatus('pierre', D3).service.level === 'unknown');

// 规则明细必须带来源与可信度（矩阵要求保留来源）
reset();
ok('门店规则条目都带来源与可信度', M.shopStatus('pierre', D3).rules.every(r => r.src && r.conf));

/* 工具升级 D / D+1 / D+2 */
M.seedScenario('fresh');
S().viewingDay={year:1,season:0,day:5};
const g = M.newActivity('toolGive',600); g.tool='axe'; g.to='copper';
ok('未完成交付时无升级流程', M.upgradeInfo({year:1,season:0,day:5})===null);
M.completeAct(g.id,true);
ok('完成交付 → 升级中，交付日 = D', M.currentUpgrade() && M.currentUpgrade().delivered==='1-0-5', M.currentUpgrade());
ok('交付后工具等级不变（仍基础）', M.effectiveLevel('axe')==='basic');
ok('D 当日状态 = 升级中', M.upgradeInfo({year:1,season:0,day:5}).status==='升级中');
ok('D+1 状态 = 升级中', M.upgradeInfo({year:1,season:0,day:6}).status==='升级中');
const up2 = M.upgradeInfo({year:1,season:0,day:7});
ok('D+2 状态 = 待取回', up2.status==='待取回');
ok('完成日期恒为 D+2', M.dkey(up2.done)==='1-0-7');
ok('铜斧：铜锭 ×5 / 2000g', up2.mat==='铜锭 ×5' && up2.fee===2000);
ok('垃圾桶费用减半', M.upgradePreview('trash','gold').fee===5000);
const t2 = M.newActivity('toolTake',600);
M.completeAct(t2.id,true);
ok('完成取回后工具等级更新为铜', M.effectiveLevel('axe')==='copper');

/* 重估预览 */
M.seedScenario('fresh');
S().viewingDay={year:1,season:0,day:3};
S().playerState.wateringCan.value='basic';
const w2 = M.newActivity('water',360); w2.workload={tiles:100,density:'normal'};
const before = M.estimateWater(w2).minutes;
const pv = M.previewStateChange('wateringCan','iridium',null);
ok('喷壶升级进入受影响列表', pv.length===1 && pv[0].a.id===w2.id, pv.length);
ok('预览显示新旧估算', pv[0].from.kind==='time' && pv[0].to.minutes < before, [before, pv[0].to.minutes]);
const w3 = M.newActivity('water',600); w3.workload={tiles:30,density:'normal'}; M.setDuration(w3.id, 40);
ok('手填浇水不受重估影响', !M.previewStateChange('wateringCan','iridium',null).some(x=>x.a.id===w3.id));
const w4 = M.newActivity('water',700); w4.workload={tiles:50,density:'normal'}; M.completeAct(w4.id,true);
ok('已完成活动不受重估影响', !M.previewStateChange('wateringCan','iridium',null).some(x=>x.a.id===w4.id));
S().viewingDay={year:1,season:0,day:10};
const w5 = M.newActivity('water',360); w5.workload={tiles:60,density:'normal'};
ok('生效日期之后的活动受影响', M.previewStateChange('wateringCan','iridium',{year:1,season:0,day:8}).some(x=>x.a.id===w5.id));
ok('生效日期之前的活动不受影响', !M.previewStateChange('wateringCan','iridium',{year:1,season:0,day:12}).some(x=>x.a.id===w5.id));
S().viewingDay={year:1,season:0,day:3};
const sh = M.newActivity('shop',540); sh.shop='pierre';
// 新的周三规则需要「社区中心 或 城镇钥匙」二者之一确定；钥匙未知时，单改社区中心不足以改变结论
ok('周三判定：钥匙未知时，仅把社区中心改为未修复不足以定论', M.previewStateChange('communityCenter','notRestored',null).length === 0);
S().playerState.keyToTown.value = 'no';
const cc = M.previewStateChange('communityCenter','notRestored',null);
ok('门店规则判断进入重估预览', cc.some(x=>x.a.id===sh.id), cc.map(x=>x.from.text+' -> '+x.to.text));

/* 作物批次 */
M.seedScenario('fresh');
S().viewingDay={year:1,season:0,day:1};
const pl = M.newActivity('plant',360); pl.crop='Parsnip';
M.completeAct(pl.id,true);
ok('完成种植 → 建立批次', M.batches().length===1);
ok('防风草首收 = 种植日 + 4 天 = 春5', M.batches()[0].firstHarvest==='1-0-5');
ok('普通室外无肥料 → 已验证', M.batches()[0].verified===true);
M.seedScenario('fresh');
S().viewingDay={year:1,season:0,day:1};
const pl2 = M.newActivity('plant',360); pl2.crop='Parsnip'; pl2.fert='some';
M.completeAct(pl2.id,true);
ok('有肥料 → 规则未验证', M.batches()[0].verified===false);

/* 锚定对照 */
M.seedScenario('fresh');
P.ui.seed.harvest = 120;
const hh = M.newActivity('harvest',360);
ok('对照初始值覆盖优先级结果', M.actTime(hh).source==='seed' && M.actTime(hh).minutes===120, M.actTime(hh));
M.setDuration(hh.id, 90);
ok('改成 90 后写入锚定观察记录', S().anchorLog.length===1 && S().anchorLog[0].seed===120 && S().anchorLog[0].final===90, S().anchorLog);
ok('对照初始值用后即失效', M.actTime(hh).source==='manual');
P.ui.seed = {};

/* 持久化 */
M.seedScenario('conflict');
const n = S().activities.length;
M.seedScenario('restored');
ok('从 localStorage 恢复活动数一致', S().activities.length===n, [n, S().activities.length]);
ok('恢复后保留目标与状态', S().goals.length===1 && S().playerState.wateringCan.value==='copper');


/* ===== 变体 D（融合）· 包含关系与空隙压缩 ===== */
M.seedScenario('fresh');
const a1 = M.newActivity('water',540); a1.manualDuration=60;
const a2 = M.newActivity('harvest',540); a2.manualDuration=60;
let fp = M.fusedPlan();
ok('同刻同长互不包含，两者都留在顶层', fp.top.length===2 && !fp.children[a1.id] && !fp.children[a2.id], fp.top.length);

M.seedScenario('fresh');
const outer = M.newActivity('travel',540); outer.manualDuration=120;   // 09:00–11:00
const inner = M.newActivity('water',570);  inner.manualDuration=30;    // 09:30–10:00
fp = M.fusedPlan();
ok('被包含项挂在容器下', (fp.children[outer.id]||[]).includes(inner.id));
ok('被包含项不在顶层', fp.top.length===1 && fp.top[0].id===outer.id);
ok('containsAct 方向正确', M.containsAct(outer, inner) && !M.containsAct(inner, outer));

M.seedScenario('fresh');
const shortB = M.newActivity('water',540);  shortB.manualDuration=30;   // 先建短的
const longB  = M.newActivity('travel',540); longB.manualDuration=60;    // 后建长的
fp = M.fusedPlan();
ok('同刻时容器先排，与建库顺序无关', fp.top.length===1 && fp.top[0].id===longB.id && (fp.children[longB.id]||[]).includes(shortB.id),
   fp.top.map(x=>x.id));

M.seedScenario('fresh');
const p1 = M.newActivity('shop',540);  p1.manualDuration=60;  // 09:00–10:00
const p2 = M.newActivity('mining',570); p2.manualDuration=60;  // 09:30–10:30
fp = M.fusedPlan();
ok('部分重叠：两者都在顶层', fp.top.length===2);
ok('部分重叠不算包含', !M.containsAct(p1,p2) && !M.containsAct(p2,p1));

M.seedScenario('conflict');
fp = M.fusedPlan();
ok('冲突场景 7 项 → 5 顶层 + 2 缩进', fp.top.length===5 && S().activities.length===7, [fp.top.length, S().activities.length]);
ok('冲突场景：浇水被赶路包含', (fp.children[S().activities.find(a=>a.type==='travel').id]||[]).length===1);
ok('冲突场景：收获被购物包含', (fp.children[S().activities.find(a=>a.type==='shop').id]||[]).length===1);

M.seedScenario('fresh');
const early = M.newActivity('water',360);  early.manualDuration=30;   // 06:00
const late  = M.newActivity('harvest',840); late.manualDuration=30;   // 14:00
fp = M.fusedPlan();
ok('顶层顺序按开始时刻', fp.top[0].id===early.id && fp.top[1].id===late.id && fp.top.length===2);


/* ===== 拖动闸门：按能力判断，不按变体名（曾经因为写死变体名而导致 F 丢失拖动） ===== */
const fakeCard = { closest: s => s === '.fcard[data-dropid]' ? { dataset: { dropid: 'abc' } } : null };
ok('拖动按能力生效：融合列表的卡片上返回目标', ((M.dragTargetAt(fakeCard) || {}).dataset || {}).dropid === 'abc');
ok('拖动在按钮上不生效', M.dragTargetAt({ closest: s => s === 'button' ? {} : null }) === null);
ok('拖动在输入框上不生效', M.dragTargetAt({ closest: s => s === 'input' ? {} : null }) === null);
ok('拖动在非卡片元素上不生效', M.dragTargetAt({ closest: () => null }) === null);
ok('没有 closest 的元素不生效（不抛错）', M.dragTargetAt({}) === null && M.dragTargetAt(null) === null);

/* ===== 落点语义（离散，无歧义） ===== */
M.seedScenario('fresh');
const dragSrc = M.newActivity('water', 360);  dragSrc.manualDuration = 30;   // 06:00–06:30
const dragTgt = M.newActivity('shop', 540);   dragTgt.manualDuration = 90;   // 09:00–10:30
ok('落点=空隙：新起点就是该空隙起点', M.fmtT(M.dropStartFor({ kind: 'gap', s: 600 }, dragSrc, null)) === '10:00');
ok('落点=卡片上半：紧贴到它前面（目标起点 − 自身时长）', M.fmtT(M.dropStartFor({ kind: 'before' }, dragSrc, dragTgt)) === '08:30');
ok('落点=卡片下半：紧贴到它后面（目标结束时刻）', M.fmtT(M.dropStartFor({ kind: 'after' }, dragSrc, dragTgt)) === '10:30');
ok('缺目标时返回 null（不做任何改动）', M.dropStartFor({ kind: 'before' }, dragSrc, null) === null);
M.moveStart(dragSrc.id, M.dropStartFor({ kind: 'before' }, dragSrc, dragTgt));
ok('落点执行后开始时刻确实改变', M.fmtT(M.tmin(dragSrc.start)) === '08:30', dragSrc.start);
M.moveStart(dragSrc.id, 200);
ok('落点不会跑出游戏日（被夹到 06:00）', dragSrc.start === '06:00', dragSrc.start);
M.moveStart(dragSrc.id, 1600);   // 超出次日 02:00，应被夹回最后一格
ok('落点不会越过游戏日末（被夹到次日 01:50）', dragSrc.start === '次日 01:50', dragSrc.start);


/* ===== 已确认的决定：默认空隙档位 = 真实比例（改动这里等于改动决定，须显式说明） ===== */
M.seedScenario('fresh');
ok('默认空隙档位 = 真实比例', S().gapMode === 'real', S().gapMode);

/* ===== 往返：做一遍 → 撤一遍，状态必须逐字节回到原样（四类半截反操作的回归闸） ===== */
const snapState = () => JSON.stringify(S());
function roundTrip(label, doFn, undoFn) {
  const before = snapState();
  doFn(); undoFn();
  const after = snapState();
  ok(label, before === after, before === after ? undefined : { same: false, delta: diffKeys(before, after) });
}
function diffKeys(a, b) {
  const A = JSON.parse(a), B = JSON.parse(b), out = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) out.push(k);
  }
  return out;
}

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 1 };
const rt1 = M.newActivity('plant', 360); rt1.crop = 'Parsnip';
roundTrip('往返：种植完成 → 取消完成，状态零残留', () => M.completeAct(rt1.id, true), () => M.completeAct(rt1.id, false));
ok('  取消后没有孤儿批次', M.batches().length === 0, M.batches().length);

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 5 };
const rt2 = M.newActivity('toolGive', 600); rt2.tool = 'axe'; rt2.to = 'copper';
roundTrip('往返：工具交付完成 → 取消完成，状态零残留', () => M.completeAct(rt2.id, true), () => M.completeAct(rt2.id, false));

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 5 };
const rt3 = M.newActivity('toolGive', 600); rt3.tool = 'axe'; rt3.to = 'copper';
const rt4 = M.newActivity('toolTake', 700); rt4.tool = 'axe'; rt4.to = 'copper';
M.completeAct(rt3.id, true);   // 只完成交付：这样 roundTrip 的 before 就是「取回未完成」
roundTrip('往返：工具取回完成 → 取消完成，状态零残留', () => M.completeAct(rt4.id, true), () => M.completeAct(rt4.id, false));
ok('  取消后工具等级回到基础', M.effectiveLevel('axe') === 'basic', M.effectiveLevel('axe'));
ok('  取消后升级流程不再标已取回', !(M.currentUpgrade() || {}).taken);

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 1 };
const rt5 = M.newActivity('water', 360); rt5.workload = { tiles: 40, density: 'normal' };
roundTrip('往返：手填时长 → 恢复为优先级结果，状态零残留', () => M.setDuration(rt5.id, 60), () => M.restoreDuration(rt5.id));
ok('  恢复后最近一次预留未被污染', S().lastReserved.water === undefined, S().lastReserved.water);

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 1 };
const rt6 = M.newActivity('water', 360); rt6.workload = { tiles: 40, density: 'normal' };
M.setDuration(rt6.id, 40);
const keep = JSON.stringify(S().lastReserved);
M.setDuration(rt6.id, 90); M.restoreDuration(rt6.id);
ok('  恢复后回退到「第一次手填之前」的值（不是第二次前的值）', S().lastReserved.water === undefined, S().lastReserved.water);
M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 1 };
S().lastReserved.harvest = { minutes: 45, date: '1-0-1' };
const rt8 = M.newActivity('harvest', 600);
M.setDuration(rt8.id, 90);
ok('  手填后最近一次预留被覆盖', S().lastReserved.harvest.minutes === 90);
M.restoreDuration(rt8.id);
ok('  恢复后回退到手填前的 45 分，而不是删除', S().lastReserved.harvest && S().lastReserved.harvest.minutes === 45, S().lastReserved.harvest);

M.seedScenario('fresh'); S().viewingDay = { year: 1, season: 0, day: 1 };
const rt7 = M.newActivity('plant', 360); rt7.crop = 'Parsnip';
M.completeAct(rt7.id, true);
const bh = M.newActivity('harvest', 500); bh.batchId = rt7.id;
M.completeAct(rt7.id, false); M.completeAct(rt7.id, true);
ok('往返：批次身份 = 种植活动，重新完成后收获的关联自动重新生效', M.batches().length === 1 && M.batches()[0].id === rt7.id);

console.log(fails? '\n== '+fails+' 项失败 ==' : '\n== 全部 '+ '通过 ==');
process.exit(fails?1:0);
