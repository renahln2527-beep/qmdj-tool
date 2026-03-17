// 奇门遁甲排盘 Web Worker
// 在后台线程加载寿星天文历库并执行排盘计算

importScripts('./wnl_lib.js');

/* =========================================================
   排盘引擎（张志春《神奇之门》拆补法 · 飞宫法）
   ========================================================= */

const LSHU       = [1, 8, 3, 4, 9, 2, 7, 6];
const LIUYI      = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
const STARS      = ['天蓬','天芮','天冲','天辅','天禽','天心','天柱','天任','天英'];
const DOORS      = ['休门','死门','伤门','杜门','中门','开门','惊门','生门','景门'];
const DOORS_RING = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];
const STARS_RING = ['天蓬','天任','天冲','天辅','天英','天芮','天柱','天心'];
const SHEN_RING  = ['值符','腾蛇','太阴','六合','白虎','玄武','九地','九天'];

const JIA_ZI = [
  '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
  '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
  '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
  '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
  '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
  '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'
];

const XUN_GAN = {
  '甲子':'戊','甲戌':'己','甲申':'庚','甲午':'辛','甲辰':'壬','甲寅':'癸'
};

const JQ_JU = {
  '冬至':[1,7,4],'小寒':[2,8,5],'大寒':[3,9,6],
  '立春':[8,5,2],'雨水':[9,6,3],'惊蛰':[1,7,4],
  '春分':[3,9,6],'清明':[4,1,7],'谷雨':[5,2,8],
  '立夏':[4,1,7],'小满':[5,2,8],'芒种':[6,3,9],
  '夏至':[9,3,6],'小暑':[8,2,5],'大暑':[7,1,4],
  '立秋':[2,5,8],'处暑':[1,4,7],'白露':[9,3,6],
  '秋分':[7,1,4],'寒露':[6,9,3],'霜降':[5,8,2],
  '立冬':[6,9,3],'小雪':[5,8,2],'大雪':[4,7,1]
};

const YANG_JQ = new Set([
  '冬至','小寒','大寒','立春','雨水','惊蛰',
  '春分','清明','谷雨','立夏','小满','芒种'
]);

function step9(gong, step, isYang) {
  let g = gong;
  for (let i = 0; i < step; i++) {
    if (isYang) g = g === 9 ? 1 : g + 1;
    else        g = g === 1 ? 9 : g - 1;
  }
  return g;
}

function paipan(y, mo, d, h, mi) {
  const solar = Solar.fromYmdHms(y, mo, d, h, mi, 0);
  const lunar  = solar.getLunar();
  const bazi   = lunar.getEightChar();

  const dayGZ = bazi.getDay();
  const shiGZ = bazi.getTime();

  // 节气与阴阳遁
  const jq     = lunar.getPrevJieQi(true).getName();
  const isYang = YANG_JQ.has(jq);

  // 符头法则 — 三元
  const dayIdx   = JIA_ZI.indexOf(dayGZ);
  let   fuTouIdx = dayIdx;
  while (fuTouIdx % 5 !== 0) fuTouIdx--;
  const yuan  = Math.floor((fuTouIdx % 15) / 5);
  const juNum = JQ_JU[jq][yuan];

  // 地盘
  const diPan = {};
  for (let i = 0; i < 9; i++) diPan[step9(juNum, i, isYang)] = LIUYI[i];

  // 值符 / 值使
  const shiIdx    = JIA_ZI.indexOf(shiGZ);
  const shiXunIdx = Math.floor(shiIdx / 10) * 10;
  const xunGan    = XUN_GAN[JIA_ZI[shiXunIdx]];

  let xunGong = 5;
  for (let g = 1; g <= 9; g++) if (diPan[g] === xunGan) xunGong = g;

  const zhiFuStar = STARS[xunGong - 1];
  const zhiShiMen = DOORS[xunGong - 1];

  // 天盘（九星 + 天干 飞宫）
  const shiGan    = shiGZ[0];
  const searchGan = (shiGan === '甲') ? xunGan : shiGan;
  let   shiGanGong = 5;
  for (let g = 1; g <= 9; g++) if (diPan[g] === searchGan) shiGanGong = g;
  const shiGanFly = shiGanGong === 5 ? 2 : shiGanGong;

  const tianPan    = { 5: { star:'', gan:'' } };
  const starOffset = STARS_RING.indexOf(zhiFuStar === '天禽' ? '天芮' : zhiFuStar);
  const tgtOffset  = LSHU.indexOf(shiGanFly);

  for (let i = 0; i < 8; i++) {
    const g        = LSHU[(tgtOffset + i) % 8];
    const s        = STARS_RING[(starOffset + i) % 8];
    let   origGong = STARS.indexOf(s) + 1;
    if (origGong === 5) origGong = 2;

    tianPan[g] = { star: s, gan: diPan[origGong] };
    if (s === '天芮') {
      tianPan[g].star = '天禽/天芮';
      tianPan[g].gan  = diPan[5] + '/' + diPan[origGong];
    }
  }

  // 人盘（八门 飞宫）
  const stepHours     = shiIdx - shiXunIdx;
  const zhiShiGongRaw = step9(xunGong, stepHours, isYang);
  const zhiShiFly     = zhiShiGongRaw === 5 ? 2 : zhiShiGongRaw;

  const menPan     = { 5: '' };
  const menOffset  = DOORS_RING.indexOf(zhiShiMen === '中门' ? '死门' : zhiShiMen);
  const doorTgtOff = LSHU.indexOf(zhiShiFly);

  for (let i = 0; i < 8; i++) {
    const g = LSHU[(doorTgtOff + i) % 8];
    menPan[g] = DOORS_RING[(menOffset + i) % 8];
  }

  // 神盘（八神 飞宫）
  const shenPan = { 5: '' };
  for (let i = 0; i < 8; i++) {
    const g = LSHU[(tgtOffset + (isYang ? i : (8 - i) % 8)) % 8];
    shenPan[g] = SHEN_RING[i];
  }

  return {
    base: {
      yearGZ:  bazi.getYear(),
      monthGZ: bazi.getMonth(),
      dayGZ,
      shiGZ,
      jq,
      ju:   (isYang ? '阳' : '阴') + '遁' + juNum + '局',
      yuan: ['上元','中元','下元'][yuan],
      xun:  '甲' + JIA_ZI[shiXunIdx][1] + '旬'
    },
    zhiFu: zhiFuStar,
    zhiShi: zhiShiMen,
    diPan, tianPan, menPan, shenPan
  };
}

// 接收主线程消息
self.onmessage = function(e) {
  try {
    const { y, mo, d, h, mi } = e.data;
    const result = paipan(y, mo, d, h, mi);
    self.postMessage({ ok: true, data: result });
  } catch(err) {
    self.postMessage({ ok: false, error: err.message });
  }
};

// 通知主线程：库已加载完毕
self.postMessage({ ok: true, ready: true });
