/* client/src/components/analytics/AnalyticsDetailModal.jsx */

import './AnalyticsDetailModal.css';

const DATE_OPTIONS = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last 1 Year' },
  { value: 'ytd', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const CHART_TITLES = {
  attendance: 'Sunday Service Attendance',
  age: 'Age Distribution',
  meeting: 'Group Meeting Distribution',
  memberAddresses: 'Member Address Distribution',
  engagement: 'Member Engagement',
  growth: 'Member Growth Trends',
  membership: 'Membership Type Distribution',
  lifeGroups: 'Members by Life Group',
  units: 'Members by Unit',
};

const AnalyticsDetailModal = ({
  chart,
  filters,
  units,
  subdistricts = [],
  showSubdistrictFilter = false,
  lifeGroups,
  filterLoading = false,
  onClose,
  onFilterChange,
  children,
}) => {
  if (!chart) return null;

  const showDate = chart === 'growth' || chart === 'attendance';
  const showHierarchyFilters = chart !== 'attendance';

  return (
    <div
      className="analytics-detail-backdrop"
      onMouseDown={onClose}
    >
      <div
        className={`analytics-detail analytics-detail--${chart}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="analytics-detail__header">
          <div>
            <h2>{CHART_TITLES[chart]}</h2>
            <p>
              Detailed analytics based on the selected filters.
            </p>
          </div>

          <button
            type="button"
            className="analytics-detail__close"
            onClick={onClose}
            aria-label="Close detailed analytics"
          >
            <span className="material-symbols-outlined">
              close
            </span>
          </button>
        </div>

        <div className="analytics-detail__filters">
          {showHierarchyFilters && showSubdistrictFilter && (
            <div className="analytics-detail__filter">
              <label htmlFor="detail-subdistrict">Subdistrict</label>
              <select id="detail-subdistrict" value={filters.subdistrictId}
                disabled={filterLoading}
                onChange={e => onFilterChange('subdistrictId', e.target.value)}>
                <option value="">All Subdistricts</option>
                {subdistricts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}
          {showHierarchyFilters && <div className="analytics-detail__filter">
            <label htmlFor="detail-unit">
              Unit
            </label>

            <select
              id="detail-unit"
              value={filters.unitId}
              disabled={filterLoading}
              onChange={(e) =>
                onFilterChange(
                  'unitId',
                  e.target.value
                )
              }
            >
              <option value="">All Units</option>

              {units.map((unit) => (
                <option
                  key={unit.id}
                  value={unit.id}
                >
                  {unit.name}
                </option>
              ))}
            </select>
          </div>}

          {showHierarchyFilters && <div className="analytics-detail__filter">
            <label htmlFor="detail-life-group">
              Life Group
            </label>

            <select
              id="detail-life-group"
              value={filters.lifeGroupId}
              disabled={filterLoading}
              onChange={(e) =>
                onFilterChange(
                  'lifeGroupId',
                  e.target.value
                )
              }
            >
              <option value="">
                All Life Groups
              </option>

              {lifeGroups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name}
                </option>
              ))}
            </select>
          </div>}

          {showDate && (
            <div className="analytics-detail__filter">
              <label htmlFor="detail-date-range">Date Range</label>
              <select
                id="detail-date-range"
                disabled={filterLoading}
                value={filters.dateRange}
                onChange={(e) => onFilterChange('dateRange', e.target.value)}
              >
                {DATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="analytics-detail__content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDetailModal;
