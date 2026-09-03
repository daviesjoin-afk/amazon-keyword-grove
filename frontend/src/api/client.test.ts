import { afterEach, describe, expect, it, vi } from 'vitest'

import { API_BASE_URL, api } from './client'

function jsonResponse(data: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => data,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('API client', () => {
  it('normalizes products and their stats from the backend', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'product-1',
              name: 'Boxwood wreath',
              site: 'US',
              category: 'Home & Garden',
              status: 'active',
              product_title: 'Artificial Boxwood Wreath for Front Door',
              bullet_points: ['Waterproof greenery'],
              core_terms: ['Boxwood Wreath'],
              updated_at: '2026-09-03T00:00:00Z',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_keywords: 12,
          source_asins: 4,
          by_match_strength: { strong: 5, medium: 4, weak: 3 },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await api.getProducts()

    expect(result.source).toBe('api')
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'product-1',
      keywordTotal: 12,
      sourceCount: 4,
      strongCount: 5,
      mediumCount: 4,
      weakCount: 3,
      coreTerms: ['boxwood wreath'],
    })
    expect(result.data[0].roots).toContain('boxwood wreath')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/products`)
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/products/product-1/stats`)
  })

  it('paginates keyword responses until every page is loaded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'keyword-1',
              keyword_raw: 'boxwood wreath',
              keyword_normalized: 'boxwood wreath',
              match_strength: 'strong',
              suggested_action: 'broad',
              monthly_search_volume: 1000,
              related_asins: ['B0TEST0001'],
              advice_confidence: 0.9,
              advice_risk_level: 'low',
            },
          ],
          pages: 2,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'keyword-2',
              keyword_raw: 'front door wreath',
              keyword_normalized: 'front door wreath',
              match_strength: 'medium',
              suggested_action: 'exact',
              monthly_search_volume: 500,
              related_asins: ['B0TEST0002'],
              advice_confidence: 80,
              advice_risk_level: 'medium',
            },
          ],
          pages: 2,
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await api.getKeywords('product/with space', {
      id: 'product-1',
      name: 'Test product',
      referenceAsin: '竞品集合',
      site: 'US',
      language: 'en_US',
      category: 'Home',
      status: '在售',
      title: 'Boxwood wreath',
      bullets: [],
      coreTerms: ['boxwood wreath'],
      keywordTotal: 0,
      strongCount: 0,
      mediumCount: 0,
      weakCount: 0,
      sourceCount: 0,
      lastImportedAt: '',
      importHealth: 100,
      roots: ['boxwood wreath', 'front door wreath'],
    })

    expect(result.data.map((item) => item.keyword)).toEqual(['boxwood wreath', 'front door wreath'])
    expect(result.data[0]).toMatchObject({ suggestedAction: '广泛探索', confidence: 90, risk: '低' })
    expect(result.data[1]).toMatchObject({ suggestedAction: '精准投放', confidence: 80, risk: '中' })
    expect(fetchMock.mock.calls[0][0]).toContain('/products/product%2Fwith%20space/keywords?page=1')
    expect(fetchMock.mock.calls[1][0]).toContain('/products/product%2Fwith%20space/keywords?page=2')
  })

  it('does not expose the saved AI key when normalizing configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        provider: 'mimo',
        base_url: 'https://api.example.com/v1',
        model: 'mimo-v2.5',
        enabled: true,
        timeout_seconds: 45,
        api_key_set: true,
        api_key_hint: '••••1234',
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const config = await api.getAIConfig()

    expect(config).toMatchObject({ apiKeySet: true, apiKeyHint: '••••1234', timeoutSeconds: 45 })
    expect(config).not.toHaveProperty('apiKey')
  })

  it('surfaces HTTP failures instead of silently returning fallback data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503, 'Service Unavailable')))

    await expect(api.getAIConfig()).rejects.toThrow('API 503: Service Unavailable')
  })
})
