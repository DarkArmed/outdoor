/* ============================================================
   scenes.ts — 卡通插图生成器（从 site/js/scenes.js 机械移植）
   每个主题返回一张 SVG 场景字符串（viewBox 800×420）。
   ============================================================ */

export const SC = {
  sky: '#7ED6FF',
  skyNight: '#2B3A67',
  sun: '#FFD93D',
  cloud: '#FFFFFF',
  hillFar: '#A5E08A',
  hillNear: '#7CDB6E',
  grassDk: '#4CAF50',
  grass: '#7CDB6E',
  river: '#4FC3F7',
  riverDk: '#29B6F6',
  rock: '#B0BEC5',
  trunk: '#8D5A3B',
  leaf: '#43A047',
  leafRed: '#F0625A',
  leafOrg: '#FFA94D',
  tent: '#FF8A65',
  tentDk: '#E85D3D',
  skin: '#FFDCB5',
  dadShirt: '#5B8DEF',
  kidShirt: '#FF6B6B',
  momShirt: '#FF8FAB',
  pants: '#4A5568',
  orange: '#FFA94D',
  purple: '#A78BFA',
  pink: '#FF8FAB',
} as const

export type ThemeKey = keyof typeof SCENES

/* ---------- 基础部件 ---------- */

export function scSky(night = false): string {
  const c = night ? SC.skyNight : SC.sky
  return `<rect width="800" height="420" fill="${c}"/>`
}

export function scSun(x: number, y: number): string {
  return `
  <g transform="translate(${x},${y})">
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45 * Math.PI) / 180
      const x1 = Math.cos(a) * 42
      const y1 = Math.sin(a) * 42
      const x2 = Math.cos(a) * 58
      const y2 = Math.sin(a) * 58
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${SC.sun}" stroke-width="7" stroke-linecap="round"/>`
    }).join('')}
    <circle r="36" fill="${SC.sun}"/>
    <circle cx="-11" cy="-6" r="4.5" fill="#5B4A00"/>
    <circle cx="11" cy="-6" r="4.5" fill="#5B4A00"/>
    <path d="M -12 8 Q 0 20 12 8" stroke="#5B4A00" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`
}

export function scMoon(x: number, y: number): string {
  return `
  <g transform="translate(${x},${y})">
    <circle r="30" fill="#FFF4C2"/>
    <circle cx="-12" cy="-8" r="24" fill="${SC.skyNight}"/>
  </g>
  ${Array.from({ length: 14 }, (_, i) => {
    const sx = 40 + ((i * 53) % 730)
    const sy = 25 + ((i * 37) % 130)
    return `<circle cx="${sx}" cy="${sy}" r="${1.5 + (i % 3)}" fill="#FFF9DB"/>`
  }).join('')}`
}

export function scCloud(x: number, y: number, s = 1): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})" fill="${SC.cloud}" opacity="0.95">
    <ellipse cx="0" cy="0" rx="34" ry="18"/>
    <ellipse cx="26" cy="-10" rx="26" ry="16"/>
    <ellipse cx="52" cy="0" rx="30" ry="16"/>
  </g>`
}

export function scHills(night = false): string {
  const f = night ? '#3D4F7C' : SC.hillFar
  const n = night ? '#2F3E63' : SC.hillNear
  return `
  <path d="M0 300 Q 150 200 320 280 T 800 270 V 420 H 0 Z" fill="${f}"/>
  <path d="M0 340 Q 200 250 420 330 T 800 320 V 420 H 0 Z" fill="${n}"/>`
}

export function scTree(x: number, y: number, s = 1, color = SC.leaf): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <rect x="-6" y="0" width="12" height="34" rx="4" fill="${SC.trunk}"/>
    <circle cx="0" cy="-18" r="30" fill="${color}"/>
    <circle cx="-20" cy="-4" r="20" fill="${color}"/>
    <circle cx="20" cy="-4" r="20" fill="${color}"/>
  </g>`
}

export function scPine(x: number, y: number, s = 1, color = SC.grassDk): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <rect x="-5" y="0" width="10" height="20" rx="3" fill="${SC.trunk}"/>
    <path d="M0 -70 L 26 -28 H 14 L 30 0 H -30 L -14 -28 H -26 Z" fill="${color}"/>
  </g>`
}

interface PersonOpts {
  hat?: string
  hair?: string
}

export function scPerson(x: number, y: number, s: number, shirt: string, opts: PersonOpts = {}): string {
  const hat = opts.hat || SC.sun
  const headwear = opts.hair
    ? `<path d="M -15 -51 A 15 15 0 0 1 15 -51 L 14 -44 Q 0 -56 -14 -44 Z" fill="${opts.hair}"/>
       <circle cx="0" cy="-63" r="6" fill="${opts.hair}"/>`
    : `<path d="M -16 -56 A 16 16 0 0 1 16 -56 L 20 -52 H -20 Z" fill="${hat}"/>`
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <line x1="-8" y1="0" x2="-8" y2="26" stroke="${SC.pants}" stroke-width="9" stroke-linecap="round"/>
    <line x1="8"  y1="0" x2="8"  y2="26" stroke="${SC.pants}" stroke-width="9" stroke-linecap="round"/>
    <rect x="-14" y="-34" width="28" height="38" rx="12" fill="${shirt}"/>
    <line x1="-14" y1="-26" x2="-26" y2="-8" stroke="${shirt}" stroke-width="8" stroke-linecap="round"/>
    <line x1="14"  y1="-26" x2="26"  y2="-8" stroke="${shirt}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="0" cy="-50" r="15" fill="${SC.skin}"/>
    <circle cx="-5" cy="-52" r="2" fill="#333"/>
    <circle cx="5"  cy="-52" r="2" fill="#333"/>
    <path d="M -5 -44 Q 0 -40 5 -44" stroke="#333" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${headwear}
  </g>`
}

/* 父子（可选妈妈同行）：爸爸牵手孩子，妈妈在另一侧 */
export function scDadKid(x: number, y: number, s = 1, mom = false): string {
  const dadX = mom ? x - 40 : x - 26
  const kidX = mom ? x + 4 : x + 24
  const kidS = s * 0.72
  let out =
    scPerson(dadX, y, s, SC.dadShirt) +
    scPerson(kidX, y + 8, kidS, SC.kidShirt, { hat: '#FFA94D' }) +
    `<line x1="${dadX + 26 * s}" y1="${y - 8 * s}" x2="${kidX - 19 * kidS}" y2="${y + 8 - 8 * kidS}" stroke="${SC.dadShirt}" stroke-width="${7 * s}" stroke-linecap="round"/>`
  if (mom) {
    out +=
      scPerson(x + 40, y, s * 0.95, SC.momShirt, { hair: '#6B4F2E' }) +
      `<line x1="${kidX + 19 * kidS}" y1="${y + 8 - 8 * kidS}" x2="${x + 40 - 26 * s * 0.95}" y2="${y - 8 * s * 0.95}" stroke="${SC.momShirt}" stroke-width="${6 * s}" stroke-linecap="round"/>`
  }
  return out
}

export function scRiver(y = 330, h = 90): string {
  return `
  <path d="M0 ${y} Q 200 ${y - 18} 400 ${y} T 800 ${y - 6} V ${y + h} H 0 Z" fill="${SC.river}"/>
  <path d="M0 ${y + 26} Q 200 ${y + 12} 400 ${y + 24} T 800 ${y + 20}" stroke="${SC.riverDk}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
  <ellipse cx="150" cy="${y + 40}" rx="26" ry="12" fill="${SC.rock}"/>
  <ellipse cx="640" cy="${y + 30}" rx="20" ry="10" fill="${SC.rock}"/>`
}

export function scFish(x: number, y: number, s = 1, color = '#FF8FAB'): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="16" ry="9" fill="${color}"/>
    <path d="M14 0 L 26 -8 L 26 8 Z" fill="${color}"/>
    <circle cx="-8" cy="-2" r="2" fill="#333"/>
  </g>`
}

export function scTent(x: number, y: number, s = 1): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <path d="M0 0 L 60 -78 L 120 0 Z" fill="${SC.tent}"/>
    <path d="M60 -78 L 120 0 H 78 L 60 -34 Z" fill="${SC.tentDk}"/>
    <path d="M60 -34 L 78 0 H 42 Z" fill="#5D4037"/>
    <line x1="-8" y1="0" x2="128" y2="0" stroke="#8D5A3B" stroke-width="5" stroke-linecap="round"/>
  </g>`
}

export function scCampfire(x: number, y: number, s = 1): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <line x1="-22" y1="4" x2="22" y2="-6" stroke="${SC.trunk}" stroke-width="9" stroke-linecap="round"/>
    <line x1="-22" y1="-6" x2="22" y2="4" stroke="${SC.trunk}" stroke-width="9" stroke-linecap="round"/>
    <path d="M0 -52 Q 16 -30 10 -14 Q 24 -20 18 -36 Q 34 -18 18 0 H -18 Q -34 -18 -18 -36 Q -24 -20 -10 -14 Q -16 -30 0 -52 Z" fill="#FF9F43"/>
    <path d="M0 -32 Q 10 -18 6 -8 Q 14 -12 12 -22 Q 20 -10 10 0 H -10 Q -20 -10 -12 -22 Q -14 -12 -6 -8 Q -10 -18 0 -32 Z" fill="#FFD93D"/>
  </g>`
}

export function scCar(x: number, y: number, s = 1, color = '#FF6B6B'): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <rect x="-50" y="-22" width="100" height="26" rx="10" fill="${color}"/>
    <path d="M-32 -22 L -20 -40 H 16 L 30 -22 Z" fill="${color}"/>
    <rect x="-18" y="-38" width="14" height="14" rx="3" fill="#BDE8FF"/>
    <rect x="2" y="-38" width="14" height="14" rx="3" fill="#BDE8FF"/>
    <circle cx="-28" cy="6" r="12" fill="#2D3748"/>
    <circle cx="28" cy="6" r="12" fill="#2D3748"/>
    <circle cx="-28" cy="6" r="5" fill="#A0AEC0"/>
    <circle cx="28" cy="6" r="5" fill="#A0AEC0"/>
  </g>`
}

export function scBike(x: number, y: number, s = 1, color = '#5B8DEF'): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round">
    <circle cx="-26" cy="0" r="18"/>
    <circle cx="26" cy="0" r="18"/>
    <path d="M-26 0 L -6 -26 L 26 0 L 0 0 L -6 -26 M -6 -26 L -14 -32 M 20 -26 L 26 0 M 20 -26 L 30 -26"/>
  </g>`
}

export function scKite(x: number, y: number, s = 1, color = '#FF8FAB'): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <path d="M0 -26 L 20 0 L 0 30 L -20 0 Z" fill="${color}"/>
    <path d="M0 30 Q 8 44 -4 52 T 6 70" stroke="${color}" stroke-width="3" fill="none"/>
    <line x1="-20" y1="0" x2="20" y2="0" stroke="#fff" stroke-width="2"/>
    <line x1="0" y1="-26" x2="0" y2="30" stroke="#fff" stroke-width="2"/>
  </g>`
}

/* ---------- 主题场景 ---------- */

export const SCENES: Record<string, (mom?: boolean) => string> = {
  water(mom = false) {
    return (
      scSky() +
      scSun(110, 90) +
      scCloud(320, 70) +
      scCloud(600, 110, 0.8) +
      scHills() +
      scRiver(320, 100) +
      scTree(90, 300, 1.1) +
      scPine(720, 300, 1.2) +
      scTree(660, 310, 0.8) +
      scFish(300, 370) +
      scFish(480, 385, 0.8, '#FFD93D') +
      scDadKid(560, 312, 1, mom)
    )
  },

  hike(mom = false) {
    return (
      scSky() +
      scSun(660, 80) +
      scCloud(200, 80) +
      scCloud(460, 50, 0.7) +
      scHills() +
      `<path d="M80 420 Q 240 330 380 350 T 720 300" stroke="#E9D8A6" stroke-width="26" fill="none" stroke-linecap="round"/>` +
      scPine(120, 340, 1.1) +
      scTree(300, 330, 0.9) +
      scPine(560, 320, 0.9) +
      scTree(700, 300, 1) +
      scDadKid(430, 342, 1, mom)
    )
  },

  camp(mom = false) {
    return (
      scSky() +
      scSun(120, 90) +
      scCloud(420, 60) +
      scCloud(640, 110, 0.75) +
      scHills() +
      scPine(90, 330, 1.2) +
      scTree(730, 320, 1.1) +
      scTent(300, 360, 1.2) +
      scCampfire(520, 380, 0.9) +
      scDadKid(180, 345, 1, mom)
    )
  },

  campnight(mom = false) {
    return (
      scSky(true) +
      scMoon(120, 80) +
      scHills(true) +
      scPine(90, 330, 1.2, '#1E2B4A') +
      scTree(730, 320, 1.1, '#1E2B4A') +
      scTent(300, 360, 1.2) +
      scCampfire(520, 380, 1) +
      `<circle cx="520" cy="360" r="70" fill="#FFD93D" opacity="0.15"/>` +
      scDadKid(180, 345, 1, mom)
    )
  },

  cycle(mom = false) {
    return (
      scSky() +
      scSun(660, 85) +
      scCloud(220, 70) +
      scCloud(500, 110, 0.8) +
      scHills() +
      `<path d="M0 400 H 800" stroke="#CBD5E0" stroke-width="34" stroke-linecap="round"/>
       <path d="M0 400 H 800" stroke="#fff" stroke-width="4" stroke-dasharray="24 20"/>` +
      scTree(110, 330, 1) +
      scTree(700, 330, 0.9) +
      scBike(340, 384, 1.1) +
      scBike(500, 390, 0.8, '#FF6B6B') +
      (mom ? scBike(650, 392, 0.95, SC.momShirt) : '') +
      scKite(180, 120, 1)
    )
  },

  grassland(mom = false) {
    return (
      scSky() +
      scSun(120, 80) +
      scCloud(360, 60) +
      scCloud(620, 100, 0.8) +
      `<path d="M0 260 Q 200 200 420 250 T 800 240 V 420 H 0 Z" fill="${SC.hillFar}"/>\n         <path d="M0 320 Q 240 270 480 310 T 800 300 V 420 H 0 Z" fill="${SC.hillNear}"/>\n      ` +
      `<g transform="translate(180,300)"><ellipse rx="26" ry="18" fill="#fff"/><circle cx="-20" cy="-12" r="10" fill="#fff"/><circle cx="-24" cy="-14" r="2" fill="#333"/><rect x="-18" y="14" width="6" height="14" fill="#E2E8F0"/><rect x="8" y="14" width="6" height="14" fill="#E2E8F0"/></g>
         <g transform="translate(650,320) scale(0.8)"><ellipse rx="26" ry="18" fill="#fff"/><circle cx="20" cy="-12" r="10" fill="#fff"/><rect x="-14" y="14" width="6" height="14" fill="#E2E8F0"/><rect x="10" y="14" width="6" height="14" fill="#E2E8F0"/></g>` +
      scKite(430, 130, 1.1, '#FFD93D') +
      scDadKid(420, 330, 1, mom)
    )
  },

  lake(mom = false) {
    return (
      scSky() +
      scSun(640, 80) +
      scCloud(180, 70) +
      scCloud(440, 50, 0.7) +
      scHills() +
      `<rect x="0" y="330" width="800" height="90" fill="${SC.river}"/>
         <path d="M60 356 Q 200 346 340 356 T 740 352" stroke="${SC.riverDk}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
         <circle cx="640" cy="330" r="26" fill="${SC.sun}" opacity="0.35"/>` +
      scTree(90, 315, 1) +
      scTree(730, 315, 0.85) +
      scDadKid(400, 318, 1, mom)
    )
  },

  redleaf(mom = false) {
    return (
      scSky() +
      scSun(660, 80) +
      scCloud(200, 70, 0.9) +
      scHills() +
      `<path d="M80 420 Q 260 330 420 350 T 740 300" stroke="#E9D8A6" stroke-width="24" fill="none" stroke-linecap="round"/>` +
      scTree(110, 335, 1.2, SC.leafRed) +
      scTree(300, 325, 0.9, SC.leafOrg) +
      scTree(560, 315, 1.1, SC.leafRed) +
      scTree(720, 300, 0.9, SC.leafOrg) +
      Array.from({ length: 8 }, (_, i) => {
        const lx = 120 + i * 90
        const ly = 150 + ((i * 47) % 130)
        return `<path d="M ${lx} ${ly} q 6 -10 12 0 q -6 10 -12 0" fill="${i % 2 ? SC.leafRed : SC.leafOrg}" transform="rotate(${i * 40} ${lx} ${ly})"/>`
      }).join('') +
      scDadKid(420, 345, 1, mom)
    )
  },

  climb() {
    return `
    <rect width="800" height="420" fill="#F0E7FF"/>
    <rect x="120" y="60" width="560" height="300" rx="20" fill="#A78BFA"/>
    <rect x="120" y="60" width="560" height="300" rx="20" fill="none" stroke="#7C63D8" stroke-width="10"/>
    ${[[180, 120, '#FFD93D'], [300, 100, '#7CDB6E'], [430, 140, '#FF8FAB'], [560, 110, '#4FC3F7'], [240, 210, '#FF8FAB'], [380, 240, '#4FC3F7'], [520, 200, '#FFD93D'], [180, 300, '#7CDB6E'], [330, 320, '#FFA94D'], [480, 300, '#FF6B6B'], [610, 250, '#7CDB6E']]
      .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="16" fill="${c}" stroke="#fff" stroke-width="4"/>`).join('')}
    <line x1="400" y1="60" x2="400" y2="330" stroke="#fff" stroke-width="4" stroke-dasharray="10 8"/>
    ${scPerson(400, 330, 1.1, SC.kidShirt, { hat: '#4FC3F7' })}
    <text x="400" y="400" text-anchor="middle" font-size="26" fill="#5B4A8A" font-weight="bold">向上爬，我最棒！</text>`
  },

  museum(mom = false) {
    return `
    <rect width="800" height="420" fill="#EAF6FF"/>
    ${scCloud(180, 70) + scCloud(560, 60, 0.8)}
    <rect x="180" y="150" width="440" height="200" rx="12" fill="#FFB84D"/>
    <path d="M160 150 L 400 70 L 640 150 Z" fill="#F08C00"/>
    <rect x="360" y="260" width="80" height="90" rx="8" fill="#8D5A3B"/>
    ${[220, 300, 460, 540].map((x) => `<rect x="${x}" y="190" width="46" height="46" rx="8" fill="#BDE8FF" stroke="#fff" stroke-width="4"/>`).join('')}
    <text x="400" y="140" text-anchor="middle" font-size="34" fill="#fff" font-weight="bold">🏛️ 科技馆</text>
    <circle cx="130" cy="330" r="26" fill="#7CDB6E"/><circle cx="680" cy="330" r="26" fill="#7CDB6E"/>
    ${scDadKid(400, 368, 1, mom)}`
  },

  snow(mom = false) {
    return `
    <rect width="800" height="420" fill="#D9EEFF"/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${30 + ((i * 71) % 770)}" cy="${20 + ((i * 53) % 240)}" r="${2 + (i % 3)}" fill="#fff"/>`).join('')}
    <path d="M0 240 Q 200 150 400 220 T 800 190 V 420 H 0 Z" fill="#fff"/>
    <path d="M0 330 Q 240 280 480 320 T 800 310 V 420 H 0 Z" fill="#EDF6FF"/>
    ${scPine(110, 330, 1.1, '#7BAE7F') + scPine(700, 320, 1.3, '#7BAE7F')}
    <g transform="translate(400,330)">
      <circle cx="0" cy="-44" r="22" fill="#fff" stroke="#CBD5E0" stroke-width="3"/>
      <circle cx="0" cy="0" r="32" fill="#fff" stroke="#CBD5E0" stroke-width="3"/>
      <circle cx="-7" cy="-48" r="2.6" fill="#333"/><circle cx="7" cy="-48" r="2.6" fill="#333"/>
      <path d="M0 -44 L 12 -41 L 0 -38 Z" fill="#FF9F43"/>
      <path d="M-14 -30 Q 0 -22 14 -30" stroke="#FF6B6B" stroke-width="5" fill="none"/>
      <line x1="-30" y1="-12" x2="-52" y2="-26" stroke="#8D5A3B" stroke-width="5" stroke-linecap="round"/>
      <line x1="30" y1="-12" x2="52" y2="-26" stroke="#8D5A3B" stroke-width="5" stroke-linecap="round"/>
      <rect x="-24" y="-70" width="48" height="12" rx="6" fill="#FF6B6B"/>
      <rect x="-16" y="-88" width="32" height="20" rx="6" fill="#FF6B6B"/>
    </g>
    ${scDadKid(590, 345, 1, mom)}`
  },

  hero(mom = false) {
    return (
      scSky() +
      scSun(110, 90) +
      scCloud(330, 60) +
      scCloud(600, 100, 0.8) +
      scHills() +
      scRiver(340, 80) +
      scPine(80, 330, 1.2) +
      scTree(720, 320, 1.1) +
      scTent(560, 360, 0.9) +
      scCampfire(700, 390, 0.6) +
      scCar(160, 386, 0.9) +
      scKite(470, 110, 0.9) +
      scFish(360, 380, 0.8) +
      scDadKid(390, 322, 1.05, mom)
    )
  },
}

/** 生成场景 SVG（mom=true 时画面加入妈妈） */
export function sceneSVG(theme: string, mom = false): string {
  const fn = SCENES[theme] || SCENES.hike
  return `<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${theme} 主题插图">${fn(mom)}</svg>`
}

/* ============================================================
   活动小图（行程时间轴用）：48×48 圆形徽章 + 关键词自动匹配
   ============================================================ */
function aiBadge(color: string, inner: string): string {
  return `<circle cx="24" cy="24" r="22" fill="#fff" stroke="${color}" stroke-width="3.5"/>${inner}`
}

const ACT_ICONS: Record<string, () => string> = {
  depart: () =>
    aiBadge(SC.dadShirt, `<g transform="translate(24,26) scale(0.32)">
    <rect x="-50" y="-22" width="100" height="26" rx="10" fill="${SC.kidShirt}"/\>\n    <path d="M-32 -22 L -20 -40 H 16 L 30 -22 Z" fill="${SC.kidShirt}"/\>\n    <rect x="-18" y="-38" width="14" height="14" rx="3" fill="#BDE8FF"/\>\n    <rect x="2" y="-38" width="14" height="14" rx="3" fill="#BDE8FF"/\>\n    <circle cx="-28" cy="6" r="12" fill="${SC.pants}"/\><circle cx="28" cy="6" r="12" fill="${SC.pants}"/\>\n  </g>`),
  arrive: () =>
    aiBadge(SC.grassDk, `
    <line x1="17" y1="38" x2="17" y2="11" stroke="${SC.trunk}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M17 11 L36 16 L17 23 Z" fill="${SC.kidShirt}"/>
    <ellipse cx="24" cy="39" rx="12" ry="3" fill="${SC.hillNear}"/>`),
  warmup: () =>
    aiBadge(SC.orange, `
    <circle cx="24" cy="14" r="6" fill="${SC.skin}"/\>\n    <line x1="24" y1="20" x2="24" y2="32" stroke="${SC.kidShirt}" stroke-width="5" stroke-linecap="round"/>
    <line x1="24" y1="23" x2="14" y2="14" stroke="${SC.kidShirt}" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="23" x2="34" y2="14" stroke="${SC.kidShirt}" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="32" x2="18" y2="41" stroke="${SC.pants}" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="32" x2="30" y2="41" stroke="${SC.pants}" stroke-width="4" stroke-linecap="round"/>`),
  hike: () =>
    aiBadge(SC.grassDk, `
    <circle cx="20" cy="13" r="5.5" fill="${SC.skin}"/\>\n    <line x1="20" y1="19" x2="22" y2="31" stroke="${SC.dadShirt}" stroke-width="5" stroke-linecap="round"/>
    <line x1="22" y1="31" x2="15" y2="40" stroke="${SC.pants}" stroke-width="4" stroke-linecap="round"/>
    <line x1="22" y1="31" x2="28" y2="40" stroke="${SC.pants}" stroke-width="4" stroke-linecap="round"/>
    <line x1="21" y1="22" x2="31" y2="28" stroke="${SC.dadShirt}" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="31" y1="16" x2="31" y2="41" stroke="${SC.trunk}" stroke-width="2.6" stroke-linecap="round"/>`),
  water: () =>
    aiBadge(SC.riverDk, `
    <path d="M10 30 Q17 24 24 30 T38 30" stroke="${SC.riverDk}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M10 37 Q17 31 24 37 T38 37" stroke="${SC.river}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M24 8 Q31 18 24 22 Q17 18 24 8 Z" fill="${SC.river}"/>
    <circle cx="15" cy="14" r="2.4" fill="${SC.riverDk}"/\><circle cx="33" cy="12" r="2" fill="${SC.riverDk}"/>`),
  bug: () =>
    aiBadge(SC.leaf, `
    <ellipse cx="24" cy="27" rx="10" ry="11" fill="${SC.leafRed}"/>
    <circle cx="24" cy="14" r="5" fill="${SC.pants}"/>
    <line x1="24" y1="18" x2="24" y2="37" stroke="#fff" stroke-width="2"/>
    <circle cx="20" cy="24" r="2" fill="#fff"/\><circle cx="28" cy="30" r="2" fill="#fff"/>
    <line x1="21" y1="10" x2="17" y2="5" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>
    <line x1="27" y1="10" x2="31" y2="5" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="26" x2="8" y2="24" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>
    <line x1="34" y1="26" x2="40" y2="24" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="33" x2="8" y2="35" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>
    <line x1="34" y1="33" x2="40" y2="35" stroke="${SC.pants}" stroke-width="2" stroke-linecap="round"/>`),
  eat: () =>
    aiBadge(SC.orange, `
    <path d="M11 24 Q24 41 37 24 Z" fill="${SC.river}"/>
    <ellipse cx="24" cy="24" rx="13" ry="3.5" fill="${SC.riverDk}"/>
    <path d="M19 17 Q21 13 19 9 M29 17 Q31 13 29 9" stroke="#A0AEC0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <line x1="36" y1="12" x2="40" y2="22" stroke="${SC.trunk}" stroke-width="2.6" stroke-linecap="round"/>`),
  tent: () =>
    aiBadge(SC.tentDk, `
    <path d="M8 38 L24 12 L40 38 Z" fill="${SC.tent}"/>
    <path d="M24 12 L40 38 H30 L24 26 Z" fill="${SC.tentDk}"/>
    <line x1="6" y1="38" x2="42" y2="38" stroke="${SC.trunk}" stroke-width="3" stroke-linecap="round"/>`),
  pack: () =>
    aiBadge(SC.purple, `
    <rect x="13" y="16" width="22" height="24" rx="8" fill="${SC.purple}"/>
    <path d="M13 24 Q24 32 35 24" stroke="#7C63D8" stroke-width="3" fill="none"/>
    <rect x="20" y="30" width="8" height="7" rx="2.5" fill="${SC.sun}"/>
    <line x1="19" y1="16" x2="19" y2="11" stroke="#7C63D8" stroke-width="3.4" stroke-linecap="round"/>
    <line x1="29" y1="16" x2="29" y2="11" stroke="#7C63D8" stroke-width="3.4" stroke-linecap="round"/>`),
  cycle: () =>
    aiBadge(SC.dadShirt, `<g transform="translate(24,28) scale(0.62)" stroke="${SC.dadShirt}" stroke-width="6" fill="none" stroke-linecap="round">
    <circle cx="-26" cy="0" r="15"/\><circle cx="26" cy="0" r="15"/>
    <path d="M-26 0 L -6 -24 L 26 0 L 0 0 L -6 -24 M -6 -24 L -13 -29 M 20 -24 L 26 0 M 20 -24 L 29 -24"/>
  </g>`),
  fire: () =>
    aiBadge(SC.kidShirt, `
    <line x1="14" y1="39" x2="34" y2="33" stroke="${SC.trunk}" stroke-width="4" stroke-linecap="round"/>
    <line x1="14" y1="33" x2="34" y2="39" stroke="${SC.trunk}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 8 Q31 17 28 23 Q33 20 31 15 Q37 23 30 32 H18 Q11 23 17 15 Q15 20 20 23 Q17 17 24 8 Z" fill="#FF9F43"/>
    <path d="M24 17 Q28 22 26 26 Q29 24 28 21 Q31 26 27 31 H21 Q17 26 20 21 Q19 24 22 26 Q20 22 24 17 Z" fill="${SC.sun}"/>`),
  sleep: () =>
    aiBadge(SC.skyNight, `
    <circle cx="21" cy="25" r="11" fill="#FFF4C2"/\>\n    <circle cx="17" cy="21" r="9" fill="#fff"/>
    <text x="28" y="20" font-size="11" font-weight="bold" fill="${SC.skyNight}">Z</text>
    <text x="34" y="14" font-size="8" font-weight="bold" fill="${SC.skyNight}">z</text>
    <ellipse cx="24" cy="38" rx="13" ry="2.6" fill="#EDF2F7"/>`),
  stars: () =>
    aiBadge(SC.purple, `
    <path d="M24 8 L27.5 19 L39 19 L30 26 L33.5 37 L24 30 L14.5 37 L18 26 L9 19 L20.5 19 Z" fill="${SC.sun}"/>
    <circle cx="38" cy="11" r="2" fill="${SC.purple}"/\><circle cx="10" cy="36" r="2" fill="${SC.purple}"/>`),
  sunrise: () =>
    aiBadge(SC.orange, `
    <path d="M12 32 A12 12 0 0 1 36 32 Z" fill="${SC.sun}"/>
    <line x1="24" y1="10" x2="24" y2="15" stroke="${SC.orange}" stroke-width="3" stroke-linecap="round"/>
    <line x1="12" y1="20" x2="15" y2="23" stroke="${SC.orange}" stroke-width="3" stroke-linecap="round"/>
    <line x1="36" y1="20" x2="33" y2="23" stroke="${SC.orange}" stroke-width="3" stroke-linecap="round"/>
    <line x1="7" y1="32" x2="41" y2="32" stroke="${SC.trunk}" stroke-width="3" stroke-linecap="round"/>
    <path d="M10 39 H38" stroke="${SC.hillNear}" stroke-width="4" stroke-linecap="round"/>`),
  home: () =>
    aiBadge(SC.grassDk, `
    <path d="M10 24 L24 11 L38 24 Z" fill="${SC.kidShirt}"/>
    <rect x="14" y="24" width="20" height="15" rx="2" fill="${SC.orange}"/>
    <rect x="21" y="30" width="7" height="9" rx="1.5" fill="${SC.trunk}"/>`),
  animal: () =>
    aiBadge(SC.pink, `
    <ellipse cx="18" cy="13" rx="3.6" ry="8" fill="#fff" stroke="${SC.pink}" stroke-width="2.4"/>
    <ellipse cx="30" cy="13" rx="3.6" ry="8" fill="#fff" stroke="${SC.pink}" stroke-width="2.4"/>
    <circle cx="24" cy="28" r="11" fill="#fff" stroke="${SC.pink}" stroke-width="2.4"/>
    <circle cx="20" cy="26" r="1.8" fill="${SC.pants}"/\><circle cx="28" cy="26" r="1.8" fill="${SC.pants}"/>
    <ellipse cx="24" cy="31" rx="2.4" ry="1.8" fill="${SC.pink}"/>`),
  leaf: () =>
    aiBadge(SC.leafRed, `
    <path d="M24 8 Q38 18 34 32 Q24 42 14 32 Q10 18 24 8 Z" fill="${SC.leafRed}"/>
    <line x1="24" y1="12" x2="24" y2="36" stroke="#C9463C" stroke-width="2"/>
    <line x1="24" y1="36" x2="28" y2="42" stroke="${SC.trunk}" stroke-width="2.6" stroke-linecap="round"/>`),
  climb: () =>
    aiBadge(SC.purple, `
    <rect x="10" y="8" width="28" height="32" rx="6" fill="${SC.purple}"/>
    <circle cx="18" cy="16" r="3" fill="${SC.sun}"/\><circle cx="30" cy="14" r="3" fill="${SC.grass}"/>
    <circle cx="24" cy="24" r="3" fill="${SC.pink}"/\><circle cx="16" cy="32" r="3" fill="${SC.river}"/>
    <circle cx="31" cy="32" r="3" fill="${SC.orange}"/>`),
  museum: () =>
    aiBadge(SC.orange, `
    <path d="M8 18 L24 8 L40 18 Z" fill="${SC.orange}"/>
    <rect x="12" y="20" width="24" height="4" fill="#F08C00"/>
    <rect x="14" y="26" width="4" height="12" fill="${SC.orange}"/\><rect x="22" y="26" width="4" height="12" fill="${SC.orange}"/\><rect x="30" y="26" width="4" height="12" fill="${SC.orange}"/>
    <line x1="9" y1="40" x2="39" y2="40" stroke="${SC.trunk}" stroke-width="3" stroke-linecap="round"/>`),
  fish: () =>
    aiBadge(SC.riverDk, `
    <ellipse cx="22" cy="26" rx="11" ry="7" fill="${SC.pink}"/>
    <path d="M32 26 L41 20 L41 32 Z" fill="${SC.pink}"/>
    <circle cx="17" cy="24" r="1.8" fill="${SC.pants}"/>
    <path d="M9 36 Q16 32 23 36 T37 36" stroke="${SC.riverDk}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M9 41 Q16 37 23 41 T37 41" stroke="${SC.river}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`),
  kite: () =>
    aiBadge(SC.pink, `
    <path d="M24 6 L36 20 L24 34 L12 20 Z" fill="${SC.pink}"/>
    <line x1="12" y1="20" x2="36" y2="20" stroke="#fff" stroke-width="2"/>
    <line x1="0" y1="-26" x2="0" y2="30" stroke="#fff" stroke-width="2"/>
    <path d="M24 34 Q28 40 23 43" stroke="${SC.pink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  camera: () =>
    aiBadge(SC.pants, `
    <rect x="9" y="16" width="30" height="22" rx="5" fill="${SC.pants}"/>
    <rect x="18" y="11" width="12" height="7" rx="2.5" fill="${SC.pants}"/>
    <circle cx="24" cy="27" r="7.5" fill="#BDE8FF" stroke="#fff" stroke-width="2.6"/>
    <circle cx="34" cy="20" r="1.6" fill="${SC.kidShirt}"/>`),
  change: () =>
    aiBadge(SC.riverDk, `
    <path d="M17 12 L10 18 L14 25 L17 22 V38 H31 V22 L34 25 L38 18 L31 12 Q24 17 17 12 Z" fill="${SC.river}"/>`),
  explore: () =>
    aiBadge(SC.sun, `
    <circle cx="21" cy="20" r="10" fill="#BDE8FF" stroke="${SC.orange}" stroke-width="3.4"/>
    <line x1="28" y1="28" x2="38" y2="38" stroke="${SC.orange}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M17 17 Q19 14 22 14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  smile: () =>
    aiBadge(SC.sun, `
    <circle cx="24" cy="24" r="13" fill="${SC.sun}"/>
    <circle cx="19.5" cy="21" r="2" fill="#5B4A00"/\><circle cx="28.5" cy="21" r="2" fill="#5B4A00"/>
    <path d="M18 27 Q24 33 30 27" stroke="#5B4A00" stroke-width="2.6" fill="none" stroke-linecap="round"/>`),
}

/* 关键词 → 活动小图（按顺序首个命中；越具体越靠前） */
const ACT_MATCH: [string, RegExp][] = [
  ['sunrise', /日出|自然醒/],
  ['sleep', /睡觉|睡前|入睡|晚安/],
  ['stars', /星星|星空/],
  ['fire', /篝火/],
  ['pack', /收营|收拾|装车|捡垃圾/],
  ['arrive', /到达|抵达/],
  ['tent', /帐篷|天幕|搭营|扎营/],
  ['cycle', /骑行|骑车|自行车/],
  ['fish', /钓鱼|小鱼|喂鱼/],
  ['bug', /虫|昆虫/],
  ['hike', /徒步|步道|登山|前进|健走/],
  ['water', /踩水|玩水|戏水|溯溪|打水仗|下水|浅滩/],
  ['leaf', /红叶|落叶|捡叶/],
  ['climb', /攀岩/],
  ['museum', /博物馆|科技馆|参观|展览/],
  ['animal', /动物|喂马|牛羊|骏马|小羊/],
  ['kite', /风筝/],
  ['camera', /拍照|合影|打卡/],
  ['change', /换.{0,2}衣|换洗/],
  ['warmup', /热身/],
  ['explore', /寻宝|探索|观察/],
  ['depart', /出发|启程/],
  ['eat', /野餐|早餐|午餐|晚餐|零食|吃|喝|煮面|热汤/],
  ['home', /返程|回家|到家|回到|折返|回程/],
]

/** 按行程文字匹配活动小图，返回 48×48 SVG */
export function actIconSVG(text: string): string {
  const m = ACT_MATCH.find(([, re]) => re.test(text))
  const key = m ? m[0] : 'smile'
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="活动：${key}">${ACT_ICONS[key]()}</svg>`
}
