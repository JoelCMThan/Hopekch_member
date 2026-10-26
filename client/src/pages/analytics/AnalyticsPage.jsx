/* client/src/pages/analytics/AnalyticsPage.jsx */

import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import analyticsService from '../../services/analyticsService';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../permissions/roles';
import AgeBarChart from '../../components/analytics/AgeBarChart';
import AnalyticsDetailModal from '../../components/analytics/AnalyticsDetailModal';
import { CHART_COLORS, BAR_COLORS, PIE_COLORS } from '../../utils/chartColors';
import './Analytics.css';

/* ── Constants ──────────────────────────────────────────────── */

const DATE_OPTIONS = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last 1 Year' },
  { value: 'ytd', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const OVERVIEW_NAME_LIMIT = 3;

const EMPTY_ANALYTICS = {
  sundayAttendanceTrend: [],
  ageDistribution: [],
  groupMeetingDistribution: [],
  memberAddressDistribution: [],
  memberEngagement: {
    totalMembers: 0,
    lifeGroup: { count: 0, percentage: 0 },
    sundayService: { count: 0, percentage: 0 },
    serving: { count: 0, percentage: 0 },
  },
  memberGrowthTrends: [],
  membershipTypeDistribution: [],
  membersByLifeGroup: [],
  membersByUnit: [],
};

/* ── Helpers ────────────────────────────────────────────────── */

const unwrapResponse = (response) => response?.data?.data ?? response?.data ?? {};
const toNumber = (value) => Number(value ?? 0);

const normaliseAnalytics = (data = {}) => ({
  sundayAttendanceTrend: data.sundayAttendanceTrend ?? [],
  ageDistribution: data.ageDistribution ?? [],
  groupMeetingDistribution: data.groupMeetingDistribution ?? [],
  memberAddressDistribution: data.memberAddressDistribution ?? [],
  memberEngagement: {
    totalMembers: toNumber(data.memberEngagement?.totalMembers),
    lifeGroup: {
      count: toNumber(data.memberEngagement?.lifeGroup?.count),
      percentage: toNumber(data.memberEngagement?.lifeGroup?.percentage),
    },
    sundayService: {
      count: toNumber(data.memberEngagement?.sundayService?.count),
      percentage: toNumber(data.memberEngagement?.sundayService?.percentage),
    },
    serving: {
      count: toNumber(data.memberEngagement?.serving?.count),
      percentage: toNumber(data.memberEngagement?.serving?.percentage),
    },
  },
  memberGrowthTrends: data.memberGrowthTrends ?? [],
  membershipTypeDistribution: data.membershipTypeDistribution ?? [],
  membersByLifeGroup: data.membersByLifeGroup ?? [],
  membersByUnit: data.membersByUnit ?? [],
});

/* ── Chart Card ─────────────────────────────────────────────── */

const ChartCard = ({ title, subtitle, onClick, children, className = '' }) => (
  <section
    className={`analytics-card analytics-card--clickable ${className}`.trim()}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <div className="analytics-card__header">
      <div>
        <h2 className="analytics-card__title">{title}</h2>
        {subtitle && <p className="analytics-card__subtitle">{subtitle}</p>}
      </div>

      <span className="material-symbols-outlined analytics-card__expand" aria-hidden="true">
        open_in_full
      </span>
    </div>

    <div className="analytics-card__body">{children}</div>
  </section>
);

/* ── Empty Chart ────────────────────────────────────────────── */

const EmptyChart = ({ message = 'No data available' }) => (
  <div className="analytics-empty">
    <span className="material-symbols-outlined">monitoring</span>
    <p>{message}</p>
  </div>
);

/* ── Member Engagement ──────────────────────────────────────── */

const EngagementChart = ({ engagement, detailed = false }) => {
  const data = [
    {
      name: 'Life Group',
      percentage: toNumber(engagement?.lifeGroup?.percentage),
      count: toNumber(engagement?.lifeGroup?.count),
      fill: CHART_COLORS.blue,
    },
    {
      name: 'Sunday Service',
      percentage: toNumber(engagement?.sundayService?.percentage),
      count: toNumber(engagement?.sundayService?.count),
      fill: CHART_COLORS.green,
    },
    {
      name: 'Serving',
      percentage: toNumber(engagement?.serving?.percentage),
      count: toNumber(engagement?.serving?.count),
      fill: CHART_COLORS.brown,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={detailed ? 390 : 260}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, name, item) => [
            `${value}% (${item.payload.count} members)`,
            'Engagement',
          ]}
        />

        <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
          {data.map((item) => (
            <Cell key={item.name} fill={item.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ── Member Growth ──────────────────────────────────────────── */

const GrowthChart = ({ data, detailed = false }) => {
  if (!data?.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={detailed ? 370 : 260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />

        <Line
          type="monotone"
          dataKey="count"
          name="New Members"
          stroke={CHART_COLORS.blue}
          strokeWidth={3}
          dot={{ r: 4, fill: CHART_COLORS.blue }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const AttendanceTrendChart = ({ data, detailed = false }) => {
  if (!data?.length) return <EmptyChart message="No Sunday attendance recorded for this date range" />;

  return (
    <ResponsiveContainer width="100%" height={detailed ? 370 : 260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Attendance']} />
        <Line type="monotone" dataKey="count" name="Attendance" stroke={CHART_COLORS.green} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.green }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

/* ── Membership Type ────────────────────────────────────────── */

const MembershipChart = ({ data, detailed = false }) => {
  if (!data?.length) return <EmptyChart />;

  return (
    <div className="analytics-pie">
      <ResponsiveContainer width="100%" height={detailed ? 320 : 260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="type"
            cx="50%"
            cy="50%"
            innerRadius={detailed ? 70 : 58}
            outerRadius={detailed ? 110 : 92}
            paddingAngle={2}
          >
            {data.map((item, index) => (
              <Cell
                key={item.type}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>

      <div className="analytics-pie__legend">
        {data.map((item, index) => (
          <div className="analytics-pie__legend-item" key={item.type}>
            <span
              className="analytics-pie__dot"
              style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
            />
            <span>{item.type}</span>
            <strong>{toNumber(item.count)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Members by Life Group ──────────────────────────────────── */

const TopNames = ({ data }) => (
  <div className="analytics-top-names" aria-label="Highest membership">
    <span className="analytics-top-names__label">Top:</span>
    {data.slice(0, OVERVIEW_NAME_LIMIT).map((item, index) => (
      <span className="analytics-top-names__item" key={item.lifeGroupId || item.unitId || item.name}>
        {index + 1}. {item.name}
      </span>
    ))}
  </div>
);

const LifeGroupChart = ({ data, detailed = false }) => {
  if (!data?.length) return <EmptyChart />;

  const height = detailed ? Math.max(390, data.length * 42) : 220;

  return (
    <div className={detailed ? 'analytics-chart-scroll' : undefined}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 25, left: detailed ? 45 : 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={detailed ? 130 : 10}
            tick={detailed ? { fontSize: 11 } : false}
          />
          <Tooltip />

          <Bar dataKey="count" name="Members" radius={[0, 6, 6, 0]}>
            {data.map((item, index) => (
              <Cell
                key={item.id || item.name}
                fill={BAR_COLORS[index % BAR_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {!detailed && <TopNames data={data} />}
    </div>
  );
};

/* ── Members by Unit ────────────────────────────────────────── */

const UnitChart = ({ data, detailed = false }) => {
  if (!data?.length) return <EmptyChart />;

  return (
    <div>
      <ResponsiveContainer width="100%" height={detailed ? 390 : 220}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: detailed ? 20 : 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={detailed ? { fontSize: 11 } : false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />

          <Bar dataKey="count" name="Members" radius={[6, 6, 0, 0]}>
            {data.map((item, index) => (
              <Cell
                key={item.id || item.name}
                fill={BAR_COLORS[index % BAR_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {!detailed && <TopNames data={data} />}
    </div>
  );
};

/* ── Group Meeting Map ──────────────────────────────────────── */

const MeetingMapBounds = ({ locations, detailed }) => {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(
      locations.map((group) => [group.latitude, group.longitude])
    );
    const fittedZoom = map.getBoundsZoom(bounds, false, [24, 24]);
    const zoom = detailed ? fittedZoom : Math.min(fittedZoom + 1, 16);

    map.setView(bounds.getCenter(), zoom, { animate: false });
    if (!detailed) {
      map.panBy([0, 32], { animate: false });
    }
  }, [detailed, locations, map]);
  return null;
};

const MeetingHeatLayer = ({ locations, detailed, memberAddresses = false }) => {
  const map = useMap();

  useEffect(() => {
    const layer = L.heatLayer(
      locations.map((group) => [group.latitude, group.longitude, 1]),
      {
        radius: memberAddresses ? 12 : detailed ? 55 : 47,
        blur: memberAddresses ? 12 : detailed ? 38 : 34,
        minOpacity: memberAddresses ? 0.04 : 0.3,
        maxZoom: 15,
        gradient: {
          0.2: '#2563eb',
          0.45: '#22c55e',
          0.65: '#fde047',
          0.82: '#f97316',
          1: '#dc2626',
        },
      }
    ).addTo(map);

    // Scale member density at the current zoom, so hundreds of nearby homes
    // do not saturate the canvas. A small kernel keeps neighbourhoods distinct.
    const updateMemberScale = () => {
      const points = locations.map(location => map.latLngToContainerPoint(
        [location.latitude, location.longitude]
      ));
      const size = map.getSize();
      const visible = points.filter(point => point.x >= -24 && point.y >= -24 &&
        point.x <= size.x + 24 && point.y <= size.y + 24);
      const cells = new Map();
      visible.forEach(point => {
        const key = `${Math.floor(point.x / 12)},${Math.floor(point.y / 12)}`;
        cells.set(key, (cells.get(key) || 0) + 1);
      });
      let peak = 1;
      cells.forEach((count, key) => {
        const [x, y] = key.split(',').map(Number);
        let density = count;
        for (let dx = -2; dx <= 2; dx += 1) {
          for (let dy = -2; dy <= 2; dy += 1) {
            if (dx || dy) {
              density += (cells.get(`${x + dx},${y + dy}`) || 0) *
                Math.exp(-(dx * dx + dy * dy) / 2);
            }
          }
        }
        peak = Math.max(peak, density);
      });
      layer.setOptions({ max: Math.max(1, peak * 0.3), maxZoom: map.getZoom() });
    };
    if (memberAddresses) {
      updateMemberScale();
      map.on('moveend resize', updateMemberScale);
    }
    return () => {
      map.off('moveend resize', updateMemberScale);
      map.removeLayer(layer);
    };
  }, [detailed, locations, map, memberAddresses]);

  return null;
};

const MeetingMap = ({ data, detailed = false, memberAddresses = false }) => {
  const [view, setView] = useState('heatmap');
  const locations = useMemo(() => (data ?? [])
    .filter((item) => item.latitude != null && item.longitude != null && item.latitude !== '' && item.longitude !== '')
    .map((item) => ({
      ...item,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }))
    .filter((item) =>
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180
    ), [data]);

  if (!locations.length) {
    return <EmptyChart message={memberAddresses ? 'No members with address coordinates for the selected filters' : 'No Life Groups with meeting coordinates'} />;
  }

  const center = [locations[0].latitude, locations[0].longitude];

  return (
    <div
      className={detailed ? 'analytics-map analytics-map--detail' : 'analytics-map'}
      onClick={detailed ? (e) => e.stopPropagation() : undefined}
    >
      <div className="analytics-map__view-toggle" role="group" aria-label="Map display">
        <button
          type="button"
          className={view === 'heatmap' ? 'is-active' : ''}
          aria-pressed={view === 'heatmap'}
          onClick={(event) => {
            event.stopPropagation();
            setView('heatmap');
          }}
        >
          Heatmap
        </button>
        <button
          type="button"
          className={view === 'markers' ? 'is-active' : ''}
          aria-pressed={view === 'markers'}
          onClick={(event) => {
            event.stopPropagation();
            setView('markers');
          }}
        >
          Markers
        </button>
      </div>
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={detailed}
        className="analytics-map__container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MeetingMapBounds locations={locations} detailed={detailed} />
        {view === 'heatmap' && <MeetingHeatLayer locations={locations} detailed={detailed} memberAddresses={memberAddresses} />}
        {view === 'markers' && locations.map((group) => (
          <CircleMarker
            key={memberAddresses ? group.memberId : group.lifeGroupId}
            center={[group.latitude, group.longitude]}
            radius={8}
            pathOptions={{
              color: '#D96C6C',
              fillColor: '#D96C6C',
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <strong>{memberAddresses ? group.memberName : group.lifeGroupName}</strong>
              <br />

              {group.unitName && (
                <>
                  Unit: {group.unitName}
                  <br />
                </>
              )}

              {memberAddresses ? group.address || 'No address details' : group.meetingAddress || 'No meeting address'}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {view === 'heatmap' && (
        <div className="analytics-map__heat-legend" aria-label="Location volume legend">
          <span>Low</span>
          <span className="analytics-map__heat-scale" aria-hidden="true" />
          <span>High</span>
        </div>
      )}
    </div>
  );
};

/* ── Analytics Page ─────────────────────────────────────────── */

const AnalyticsPage = () => {
  const { user } = useAuth();
  const showSubdistrictFilter = [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(user?.role);
  const [subdistricts, setSubdistricts] = useState([]);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [units, setUnits] = useState([]);
  const [lifeGroups, setLifeGroups] = useState([]);

  const [filters, setFilters] = useState({
    dateRange: '1y',
    subdistrictId: '',
    unitId: '',
    lifeGroupId: '',
  });

  const [selectedChart, setSelectedChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Load Analytics ───────────────────────────────────────── */

  const loadAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError('');

      const response = await analyticsService.getAnalytics(nextFilters);
      const data = unwrapResponse(response);

      setAnalytics(normaliseAnalytics(data));
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Load Filter Options ──────────────────────────────────── */

  const loadFilters = async (unitId = '', subdistrictId = '') => {
    try {
      setFilterLoading(true);

      const response = await analyticsService.getFilters(unitId, subdistrictId);
      const data = unwrapResponse(response);

      setSubdistricts(data.subdistricts ?? []);
      setUnits(data.units ?? []);
      setLifeGroups(data.lifeGroups ?? []);
    } catch (err) {
      console.error('Failed to load analytics filters:', err);
    } finally {
      setFilterLoading(false);
    }
  };

  /* ── Initial Load ─────────────────────────────────────────── */

  useEffect(() => {
    loadFilters();
    loadAnalytics({ dateRange: '1y', subdistrictId: '', unitId: '', lifeGroupId: '' });
  }, []);

  /* ── Main Filters ─────────────────────────────────────────── */

  const handleFilterChange = async (field, value) => {
    let nextFilters;

    if (field === 'subdistrictId') {
      nextFilters = { ...filters, subdistrictId: value, unitId: '', lifeGroupId: '' };
      setFilters(nextFilters);
      await loadFilters('', value);
    } else if (field === 'unitId') {
      nextFilters = { ...filters, unitId: value, lifeGroupId: '' };
      setFilters(nextFilters);
      await loadFilters(value, filters.subdistrictId);
    } else {
      nextFilters = { ...filters, [field]: value };
      setFilters(nextFilters);
    }

    await loadAnalytics(nextFilters);
  };

  const handleClearFilters = async () => {
    const cleared = { dateRange: '1y', subdistrictId: '', unitId: '', lifeGroupId: '' };

    setFilters(cleared);
    await loadFilters();
    await loadAnalytics(cleared);
  };

  /* ── Detail Modal Filters ─────────────────────────────────── */

  const handleDetailFilterChange = handleFilterChange;

  const engagementSubtitle = useMemo(() => {
    const total = analytics.memberEngagement?.totalMembers ?? 0;
    return `${total} members included`;
  }, [analytics.memberEngagement]);

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className="analytics-page">

      {/* Header */}
      <div className="analytics-page__header">
        <div>
          <h1>Church Analytics</h1>
          <p>Explore membership, engagement and organizational insights.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters">
        <div className={`analytics-filters__fields${showSubdistrictFilter ? ' analytics-filters__fields--four' : ''}`}>
        {showSubdistrictFilter && (
          <div className="analytics-filter">
            <select id="analytics-subdistrict" aria-label="Subdistrict" value={filters.subdistrictId}
              disabled={loading || filterLoading}
              onChange={e => handleFilterChange('subdistrictId', e.target.value)}>
              <option value="">Subdistrict: All</option>
              {subdistricts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        )}
        <div className="analytics-filter">
          <select
            id="analytics-unit"
            aria-label="Unit"
            value={filters.unitId}
            disabled={loading || filterLoading}
            onChange={(e) => handleFilterChange('unitId', e.target.value)}
          >
            <option value="">Unit: All</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-filter">
          <select
            id="analytics-group"
            aria-label="Life Group"
            value={filters.lifeGroupId}
            disabled={loading || filterLoading}
            onChange={(e) => handleFilterChange('lifeGroupId', e.target.value)}
          >
            <option value="">Life Group: All</option>
            {lifeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-filter">
          <select
            id="analytics-date"
            aria-label="Date Range"
            disabled={loading || filterLoading}
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Date Range: {option.label}
              </option>
            ))}
          </select>
        </div>

        </div>

        <button
          type="button"
          className="analytics-clear-filter"
          onClick={handleClearFilters}
          disabled={loading || filterLoading}
          title="Clear filters"
          aria-label="Clear filters"
        >
          <span className="material-symbols-outlined">filter_alt_off</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="analytics-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="analytics-loading">
          <div className="analytics-loading__spinner" />
          <p>Loading analytics...</p>
        </div>
      ) : (
        <div className="analytics-grid">

          <ChartCard
            title="Sunday Service Attendance"
            subtitle="Attendance trend for the selected date range"
            onClick={() => setSelectedChart('attendance')}
          >
            <AttendanceTrendChart data={analytics.sundayAttendanceTrend} />
          </ChartCard>

          {/* Row 1 */}
          <ChartCard
            title="Group Meeting Distribution"
            subtitle="Life Group meeting locations"
            onClick={() => setSelectedChart('meeting')}
          >
            <MeetingMap data={analytics.groupMeetingDistribution} />
          </ChartCard>

          <ChartCard
            title="Member Engagement"
            subtitle={engagementSubtitle}
            onClick={() => setSelectedChart('engagement')}
          >
            <EngagementChart engagement={analytics.memberEngagement} />
          </ChartCard>

          <ChartCard
            title="Member Address Distribution"
            subtitle="Member home locations with saved coordinates"
            onClick={() => setSelectedChart('memberAddresses')}
          >
            <MeetingMap data={analytics.memberAddressDistribution} memberAddresses />
          </ChartCard>

          {/* Row 2 */}
          <ChartCard
            title="Member Growth Trends"
            subtitle="New members by month"
            onClick={() => setSelectedChart('growth')}
          >
            <GrowthChart data={analytics.memberGrowthTrends} />
          </ChartCard>

          <ChartCard
            title="Membership Type Distribution"
            subtitle="Current membership composition"
            onClick={() => setSelectedChart('membership')}
          >
            <MembershipChart data={analytics.membershipTypeDistribution} />
          </ChartCard>

          {/* Row 3 */}
          <ChartCard className="analytics-card--age" title="Age Distribution" subtitle="Members by age bracket" onClick={() => setSelectedChart('age')}>
            <AgeBarChart data={analytics.ageDistribution} height={260} />
          </ChartCard>

          <ChartCard
            title="Members by Life Group"
            subtitle="All Life Groups · Highest membership names shown below"
            onClick={() => setSelectedChart('lifeGroups')}
          >
            <LifeGroupChart data={analytics.membersByLifeGroup} />
          </ChartCard>

          <ChartCard
            title="Members by Unit"
            subtitle="All Units · Highest membership names shown below"
            onClick={() => setSelectedChart('units')}
          >
            <UnitChart data={analytics.membersByUnit} />
          </ChartCard>
        </div>
      )}

      {/* Detail Modal */}
      {selectedChart && (
        <AnalyticsDetailModal
          chart={selectedChart}
          filters={filters}
          units={units}
          subdistricts={subdistricts}
          showSubdistrictFilter={showSubdistrictFilter}
          lifeGroups={lifeGroups}
          filterLoading={loading || filterLoading}
          onClose={() => setSelectedChart(null)}
          onFilterChange={handleDetailFilterChange}
        >
          {selectedChart === 'age' && <AgeBarChart data={analytics.ageDistribution} height={320} />}
          {selectedChart === 'attendance' && <AttendanceTrendChart data={analytics.sundayAttendanceTrend} detailed />}
          {selectedChart === 'meeting' && (
            <MeetingMap data={analytics.groupMeetingDistribution} detailed />
          )}
          {selectedChart === 'memberAddresses' && (
            <MeetingMap data={analytics.memberAddressDistribution} memberAddresses detailed />
          )}

          {selectedChart === 'engagement' && (
            <EngagementChart engagement={analytics.memberEngagement} detailed />
          )}

          {selectedChart === 'growth' && (
            <GrowthChart data={analytics.memberGrowthTrends} detailed />
          )}

          {selectedChart === 'membership' && (
            <MembershipChart data={analytics.membershipTypeDistribution} detailed />
          )}

          {selectedChart === 'lifeGroups' && (
            <LifeGroupChart data={analytics.membersByLifeGroup} detailed />
          )}

          {selectedChart === 'units' && (
            <UnitChart data={analytics.membersByUnit} detailed />
          )}
        </AnalyticsDetailModal>
      )}
    </div>
  );
};

export default AnalyticsPage;
