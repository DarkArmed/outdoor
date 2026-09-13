import { describe, it, expect } from 'vitest'
import { actIconSVG, sceneSVG, SC } from './scenes.ts'

describe('scenes', () => {
  it('sceneSVG returns svg with viewBox 800 420', () => {
    const svg = sceneSVG('water')
    expect(svg).toContain('<svg viewBox="0 0 800 420"')
    expect(svg).toContain('</svg>')
  })

  it('sceneSVG defaults to default theme for unknown theme', () => {
    const svg = sceneSVG('unknown')
    expect(svg).toContain('aria-label="unknown 主题插图"')
  })

  it('actIconSVG returns an svg', () => {
    const svg = actIconSVG('到浅滩踩水')
    expect(svg).toContain('<svg viewBox="0 0 48 48"')
  })

  it('SC includes previously undefined colors used in ACT_ICONS', () => {
    expect(SC.orange).toBeDefined()
    expect(SC.purple).toBeDefined()
    expect(SC.pink).toBeDefined()
    expect(SC.grass).toBeDefined()
  })
})
