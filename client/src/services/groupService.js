import api from './api';

// Photon supports OSM search-as-you-type; the public Nominatim endpoint does not.
const geocoder = (import.meta.env.VITE_PHOTON_URL || 'https://photon.komoot.io').replace(/\/$/, '');

const lookupAddress = async (path, params, signal) => {
  const response = await fetch(`${geocoder}/${path}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });

  if (!response.ok) throw new Error('Address lookup failed');

  const data = await response.json();

  return (data.features ?? []).flatMap((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates ?? [];
    const p = feature.properties ?? {};

    // Check country metadata as well as the API filter, including reverse lookups.
    if (p.countrycode?.toUpperCase() !== 'MY') return [];

    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    // Photon city/district labels can describe surrounding areas rather than
    // the street's postal address. Do not append these inferred area names.
    // Keep a selected residence name and any mapped house/street details.
    const address = [...new Set([
      p.name,
      street,
      p.state,
      p.postcode,
      p.country,
    ].filter(Boolean))].join(', ');

    if (!address || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return [];
    }

    const isKuching = [p.city, p.district, p.county, p.name].some(
      (part) => /\bkuching\b/i.test(part || '')
    );
    const isSarawak = /\bsarawak\b/i.test(p.state || '');

    return [{
      name: p.name || street || address,
      address,
      latitude,
      longitude,
      priority: isKuching ? 0 : isSarawak ? 1 : 2,
    }];
  });
};

const groupService = {
  searchMeetingAddresses: async (query, signal) => {
    // Expand common Malaysian address abbreviations before searching.
    const addressQuery = query.trim()
      .replace(/\bjln\.?\s+/gi, 'Jalan ')
      .replace(/\blrg\.?\s+/gi, 'Lorong ')
      .replace(/\btmn\.?\s+/gi, 'Taman ')
      .replace(/\bkg\.?\s+/gi, 'Kampung ')
      .replace(/^no\.?\s*/i, '');
    const params = {
      q: addressQuery,
      limit: 20,
      countrycode: 'MY',
      lang: 'en',
      lat: 1.5533,
      lon: 110.3592,
      zoom: 10,
      location_bias_scale: 0.1,
    };
    let places = await lookupAddress('api/', params, signal);

    // OSM may know the street even when the individual house is not mapped.
    // Return the real street address; never invent a house coordinate.
    const streetQuery = addressQuery.replace(/^\d+[a-z]?(?:[-/]\d+[a-z]?)?\s*[,\s]\s*/i, '');
    if (!places.length && streetQuery !== addressQuery && streetQuery.length >= 3) {
      places = await lookupAddress('api/', { ...params, q: streetQuery }, signal);
    }

    // Keep provider relevance within each region; prefer Kuching, then Sarawak.
    return places.sort((a, b) => a.priority - b.priority).slice(0, 8);
  },
  reverseMeetingAddress: async (latitude, longitude, signal) => {
    const places = await lookupAddress('reverse', {
      lat: latitude,
      lon: longitude,
      limit: 1,
      lang: 'en',
    }, signal);

    return places[0] ?? null;
  },
  activate: (id) => api.patch(`/groups/${id}/activate`),
  inactivate: (id) => api.patch(`/groups/${id}/inactivate`),
  getGroups: (params = {}) => api.get('/groups', { params }),
  getGroup: (id) => api.get(`/groups/${id}`),
  createGroup: (data) => api.post('/groups', data),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
  splitGroup: (id, data) => api.post(`/groups/${id}/split`, data),
  getUnits: () => api.get('/groups/lookup/units'),
  getSubdistricts: () => api.get('/groups/lookup/subdistricts'),
};

export default groupService;
