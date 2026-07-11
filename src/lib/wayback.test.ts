import { describe, expect, it } from 'vitest'
import { parseWaybackConfig, pickYearlyReleases } from './wayback'

const CONFIG = {
  '100': {
    itemTitle: 'World Imagery (Wayback 2014-02-20)',
    itemURL: 'https://example.com/tile/100/{level}/{row}/{col}',
  },
  '200': {
    itemTitle: 'World Imagery (Wayback 2014-11-05)',
    itemURL: 'https://example.com/tile/200/{level}/{row}/{col}',
  },
  '300': {
    itemTitle: 'World Imagery (Wayback 2020-06-10)',
    itemURL: 'https://example.com/tile/300/{level}/{row}/{col}',
  },
  bad: {
    itemTitle: 'No date here',
    itemURL: 'https://example.com/x',
  },
}

describe('parseWaybackConfig', () => {
  it('提取日期并转换瓦片模板占位符', () => {
    const releases = parseWaybackConfig(CONFIG)
    expect(releases).toHaveLength(3)
    expect(releases[0].date).toBe('2014-02-20')
    expect(releases[0].tileUrl).toBe('https://example.com/tile/100/{z}/{y}/{x}')
  })

  it('按日期升序排列并跳过无日期条目', () => {
    const releases = parseWaybackConfig(CONFIG)
    expect(releases.map((r) => r.date)).toEqual(['2014-02-20', '2014-11-05', '2020-06-10'])
  })
})

describe('pickYearlyReleases', () => {
  it('每年保留最后一个 release', () => {
    const yearly = pickYearlyReleases(parseWaybackConfig(CONFIG))
    expect(yearly).toHaveLength(2)
    expect(yearly[0].date).toBe('2014-11-05')
    expect(yearly[1].year).toBe(2020)
  })
})
