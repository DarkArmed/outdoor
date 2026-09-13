// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { driveMapSVG, footprintMapSVG, hikeMapSVG } from './maps'
import type { MapData, DriveSummary, HikeSummary } from './mapTypes'
import { sceneSVG } from './scenes'

const drive: DriveSummary = { from: '家', to: '营地', time: '1小时', km: 60 }
const hike: HikeSummary = { title: '山野步道', length: '3km', waypoints: [{ name: '起点' }, { name: '终点', act: '野餐' }] }
const plan = { id: 'test', title: '测试计划', date: '9月5日', location: '营地', drive, hike }
const data: MapData = {
  plans: [plan],
  routes: {
    test: {
      drive: {
        from: { name: '家', coord: [116.2, 39.8] },
        to: { name: '营地', coord: [116.8, 40.2] },
        polyline: [[116.2, 39.8], [116.4, 40], [116.8, 40.2]],
        distance: 60, duration: 80,
        roads: [{ name: '山路', point: [116.4, 40] }],
        landmarks: [{ name: '桥', icon: '🌉', coord: [116.5, 40.1] }],
      },
      hike: {
        title: hike.title, length: hike.length,
        spots: [{ name: '起点', coord: [116.8, 40.2] }, { name: '终点', coord: [116.81, 40.21], act: '野餐' }],
        path: [[116.8, 40.2], [116.805, 40.202], [116.81, 40.21]],
      },
    },
  },
  network: { ways: [
    { cls: 'motorway', polyline: [[116.3, 39.9], [116.6, 40.1]] },
    { cls: 'trunk', polyline: [[116.4, 40], [116.7, 40.2]] },
    { cls: 'primary', polyline: [[116.2, 39.8], [116.5, 40]] },
  ] },
}

function legacy(input: MapData) {
  const context = createContext({ ROUTES: input.routes, NETWORK: input.network, PLANS: input.plans, plan })
  runInContext(readFileSync(new URL('../../../site/js/maps.js', import.meta.url), 'utf8'), context)
  return (expression: string): string => runInContext(expression, context) as string
}

describe('mechanical SVG port', () => {
  it('preserves complete legacy drive, hike and footprint SVG including road layers', () => {
    const old = legacy(data)
    expect(driveMapSVG(plan, data)).toBe(old('driveMapSVG(plan)'))
    expect(hikeMapSVG(plan, data)).toBe(old('hikeMapSVG(plan)'))
    expect(footprintMapSVG(['test'], data)).toBe(old("footprintMapSVG(['test'])"))
  })

  it('preserves schematic fallback output', () => {
    const old = legacy({})
    expect(driveMapSVG(plan)).toBe(old('driveMapSVG(plan)'))
    expect(hikeMapSVG(plan)).toBe(old('hikeMapSVG(plan)'))
  })

  it('does not leak route data across render calls', () => {
    expect(driveMapSVG(plan, data)).toContain('自驾路线图（真实地理）')
    expect(driveMapSVG(plan)).toContain('自驾路线示意图')
    expect(footprintMapSVG(['test'])).toBe('')
    expect(hikeMapSVG({ id: 'empty', hike: { title: '', waypoints: [] } })).toBe('')
  })

  it('preserves all legacy theme scenes with and without mom', () => {
    const context = createContext({})
    runInContext(readFileSync(new URL('../../../site/js/scenes.js', import.meta.url), 'utf8'), context)
    for (const theme of ['water', 'hike', 'camp', 'cycle', 'redleaf', 'snow']) {
      for (const mom of [false, true]) {
        expect(sceneSVG(theme, mom)).toBe(runInContext(`sceneSVG('${theme}', ${mom})`, context))
      }
    }
  })
})
