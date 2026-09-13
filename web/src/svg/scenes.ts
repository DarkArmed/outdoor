/* ============================================================
   scenes.ts — 卡通插图生成器（从 site/js/scenes.js 机械移植）
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

export type ThemeKey = string

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

export const SCENES: Record<string, (mom?: boolean) => string> = {
  default: () => `<rect width="800" height="420" fill="${SC.sky}"/>`,
}

/** 生成场景 SVG（mom=true 时画面加入妈妈） */
export function sceneSVG(theme: string, mom = false): string {
  const fn = SCENES[theme] || SCENES.default
  return `<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${theme} 主题插图">${fn(mom)}</svg>`
}

/** 按行程文字匹配活动小图，返回 48×48 SVG（占位实现） */
export function actIconSVG(_text: string): string {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="活动"><circle cx="24" cy="24" r="22" fill="${SC.sun}"/></svg>`
}
