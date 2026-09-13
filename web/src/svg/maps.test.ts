import { describe, it, expect } from 'vitest'
import { MAP_C, driveMapSVG, hikeMapSVG, footprintMapSVG } from './maps'

describe('maps.ts', () => {
  it('exports MAP_C color constants', () => {
    expect(MAP_C.paper).toBe('#F4EFE4')
    expect(MAP_C.route).toBe('#E8590C')
    expect(MAP_C.trail).toBe('#B07D3B')
  })

  it('driveMapSVG falls back to schematic map without route data', () => {
    const svg = driveMapSVG({
      id: 'no-route-plan',
      drive: { from: '家', to: '测试营地', time: '1.5h', km: 90 },
    })
    expect(svg).toContain('<svg')
    expect(svg).toContain('自驾路线示意图')
    expect(svg).toContain('测试营地')
  })

  it('hikeMapSVG falls back to schematic map without route data', () => {
    const svg = hikeMapSVG({
      id: 'no-route-hike',
      hike: {
        title: '测试徒步',
        length: '3km',
        waypoints: [
          { name: '起点', act: '出发' },
          { name: '山顶', act: '野餐' },
          { name: '终点', act: '返程' },
        ],
      },
    })
    expect(svg).toContain('<svg')
    expect(svg).toContain('徒步路线示意图')
    expect(svg).toContain('测试徒步')
  })

  it('footprintMapSVG returns empty when routes/plans are absent', () => {
    expect(footprintMapSVG([], {}, [])).toBe('')
  })
})
