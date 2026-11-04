import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CityNode } from '../types';
import { countCityMatches, filterCities } from './citySearch';

function place(
  id: string,
  name: string,
  district: string,
  cityType = 'Municipality',
): CityNode {
  return {
    id,
    name,
    nepaliName: '',
    district,
    province: 'Bagmati',
    cityType,
    lat: 27.5,
    lng: 85.2,
    elevationM: 1000,
    isMajorHub: false,
    connectedHighways: [],
  };
}

describe('place search identity', () => {
  it('keeps same-named settlements from different districts separate', () => {
    const places = [
      place('pal-tribeni-dhading', 'Tribeni', 'Dhading'),
      place('pal-tribeni-nawalpur', 'Tribeni', 'Nawalpur'),
    ];

    assert.equal(countCityMatches(places, 'tribeni'), 2);
    assert.deepEqual(
      filterCities(places, 'tribeni', 8).map((item) => item.id).sort(),
      ['pal-tribeni-dhading', 'pal-tribeni-nawalpur'],
    );
  });

  it('collapses duplicate source records for the same district place', () => {
    const places = [
      place('source-a-banepa', 'Banepa', 'Kavrepalanchok'),
      place('source-b-banepa', 'Banepa', 'Kavrepalanchok'),
    ];

    assert.equal(countCityMatches(places, 'banepa'), 1);
    assert.equal(filterCities(places, 'banepa', 8).length, 1);
  });

  it('excludes infrastructure POIs from routeable settlement counts', () => {
    const places = [
      place('city-pokhara', 'Pokhara', 'Kaski'),
      place('poi-pokhara-bus-park', 'Pokhara Bus Park', 'Kaski', 'bus station'),
    ];

    assert.equal(countCityMatches(places, 'pokhara'), 1);
    assert.deepEqual(filterCities(places, 'pokhara', 8).map((item) => item.id), ['city-pokhara']);
  });
});
