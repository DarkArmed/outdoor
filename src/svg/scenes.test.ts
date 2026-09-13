import { describe, it, expect } from 'vitest'
import { actIconSVG, sceneSVG, SC, SCENES } from './scenes.ts'

describe('scenes', () => {
  it('sceneSVG returns svg with viewBox 800 420', () => {
    const svg = sceneSVG('water')
    expect(svg).toContain('<svg viewBox="0 0 800 420"')
    expect(svg).toContain('</svg>')
  })

  it('sceneSVG renders each known theme', () => {
    const themes = Object.keys(SCENES)
    for (const theme of themes) {
      const svg = sceneSVG(theme)
      expect(svg).toContain(`aria-label="${theme} 主题插图"`)
    }
  })

  it('sceneSVG defaults to hike for unknown theme', () => {
    const svg = sceneSVG('unknown')
    expect(svg).toContain('aria-label="unknown 主题插图"')
    expect(svg).toContain(SC.sky)
  })

  it('sceneSVG includes mom when requested for themes that support mom', () => {
    const svg = sceneSVG('hike', true)
    expect(svg).toContain(SC.momShirt)
  })

  it('actIconSVG matches water activity', () => {
    const svg = actIconSVG('到浅滩踩水')
    expect(svg).toContain('aria-label="活动：water"')
  })

  it('actIconSVG matches hiking activity', () => {
    const svg = actIconSVG('沿步道徒步')
    expect(svg).toContain('aria-label="活动：hike"')
  })

  it('actIconSVG matches eating activity', () => {
    const svg = actIconSVG('野餐吃三明治')
    expect(svg).toContain('aria-label="活动：eat"')
  })

  it('actIconSVG falls back to smile', () => {
    const svg = actIconSVG('不知所云的文字')
    expect(svg).toContain('aria-label="活动：smile"')
  })

  it('SC includes previously undefined colors used in ACT_ICONS', () => {
    expect(SC.orange).toBeDefined()
    expect(SC.purple).toBeDefined()
    expect(SC.pink).toBeDefined()
    expect(SC.grass).toBeDefined()
  })
})
