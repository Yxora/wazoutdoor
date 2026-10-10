import { describe, expect, it } from 'vitest'
import { kindOfCategory, PLACE_CATEGORY_LABEL, type PlaceCategory } from './place'

describe('kindOfCategory', () => {
  it.each([
    ['water', 'water'],
    ['hut', 'shelter'],
    ['refuge', 'shelter'],
    ['lodge', 'shelter'],
  ] as [PlaceCategory, string][])('%s -> %s', (category, kind) => {
    expect(kindOfCategory(category)).toBe(kind)
  })

  it('a un libellé pour chaque catégorie', () => {
    for (const category of ['water', 'hut', 'refuge', 'lodge'] as PlaceCategory[]) {
      expect(PLACE_CATEGORY_LABEL[category]).toBeTruthy()
    }
  })
})
