import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import groupService from '../../services/groupService';

const icon = L.icon({
  iconUrl: markerUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// Kuching, Sarawak as default center
const defaultCenter = [1.5533, 110.3592];

function LocationMarker({ latitude, longitude, disabled, onMove }) {
  const map = useMap();
  useMapEvents({
    click: (event) => {
      if (!disabled) onMove(event.latlng);
    },
  });

  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.setView([latitude, longitude], 16);
    }
  }, [latitude, longitude, map]);

  if (latitude == null || longitude == null) return null;

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      draggable={!disabled}
      eventHandlers={{
        dragend: (event) => onMove(event.target.getLatLng()),
      }}
    />
  );
}

function ResizeMap({ expanded }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [expanded, map]);

  return null;
}

export default function MeetingLocationPicker({ value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(-1);
  const request = useRef(null);
  const revision = useRef(0);
  const input = useRef(null);
  const manualAddress = useRef(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const hasLocation = value.latitude != null && value.longitude != null;

  useEffect(() => {
    if (!mapExpanded) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMapExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mapExpanded]);

  const cancelLookup = () => {
    revision.current += 1;
    request.current?.abort();
    setSuggestions([]);
    setActive(-1);
  };

  useEffect(() => {
    if (query.trim().length < 3 || disabled) return;

    const controller = new AbortController();
    request.current = controller;
    const current = revision.current;
    const timer = setTimeout(async () => {
      setMessage('Searching addresses…');
      try {
        const results = await groupService.searchMeetingAddresses(query.trim(), controller.signal);
        if (controller.signal.aborted || current !== revision.current) return;
        setSuggestions(results);
        setMessage(results.length ? '' : 'No matching addresses. Try a more specific address or click the map.');
      } catch {
        if (!controller.signal.aborted && current === revision.current) {
          setMessage('Address search is unavailable. You can enter an address and click the map.');
        }
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, disabled]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (disabled) request.current?.abort();
  }, [disabled]);

  const select = (place) => {
    manualAddress.current = false;
    cancelLookup();
    setQuery('');
    setMessage('');
    onChange({
      groupAddress: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    input.current?.focus();
  };

  const move = async ({ lat, lng }) => {
    if (disabled) return;

    cancelLookup();
    setQuery('');
    const latitude = Number(lat.toFixed(8));
    const longitude = Number(((lng + 180) % 360 + 360) % 360 - 180);
    const location = {
      groupAddress: value.groupAddress,
      latitude,
      longitude: Number(longitude.toFixed(8)),
    };
    onChange(location);
    // Preserve house/unit details entered by the user when adjusting the pin.
    if (manualAddress.current || (hasLocation && value.groupAddress.trim())) {
      setMessage('Location updated. Your full meeting address has been kept.');
      return;
    }
    setMessage('Finding the address…');
    const controller = new AbortController();
    request.current = controller;
    const current = revision.current;
    try {
      const place = await groupService.reverseMeetingAddress(location.latitude, location.longitude, controller.signal);
      if (controller.signal.aborted || current !== revision.current) return;
      if (place) onChange({ ...location, groupAddress: place.address });
      setMessage(place ? '' : 'Coordinates updated. No nearby address found; enter the address manually.');
    } catch {
      if (!controller.signal.aborted && current === revision.current) {
        setMessage('Coordinates updated. Address lookup is unavailable; check the address manually.');
      }
    }
  };

  return (
    <div className="group-modal__field group-modal__location">
      <label className="group-modal__label" htmlFor="meeting-address">Meeting Address</label>
      <input
        ref={input}
        id="meeting-address"
        className="group-modal__input"
        value={value.groupAddress}
        disabled={disabled}
        placeholder="Search Jalan, Lorong, Taman, or residence name"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls="meeting-address-results"
        aria-describedby="meeting-location-help"
        aria-activedescendant={active >= 0 ? `meeting-address-${active}` : undefined}
        onChange={(event) => {
          const address = event.target.value;
          const keepLocation = hasLocation && address.trim().length > 0;
          manualAddress.current = address.trim().length > 0;
          cancelLookup();
          setQuery(keepLocation ? '' : address);
          setMessage('');
          onChange({
            groupAddress: address,
            latitude: keepLocation ? value.latitude : null,
            longitude: keepLocation ? value.longitude : null,
          });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelLookup();
            setQuery('');
            setMessage('');
            event.stopPropagation();
          }

          if (!suggestions.length) return;

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (
              index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length
            ) % suggestions.length);
          }

          if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            select(suggestions[active]);
          }
        }}
      />

      {hasLocation && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled}
          onClick={() => {
            cancelLookup();
            manualAddress.current = false;
            setQuery(value.groupAddress);
            setMessage('Search for the new location and select a suggestion.');
            onChange({
              groupAddress: value.groupAddress,
              latitude: null,
              longitude: null,
            });
            input.current?.focus();
            input.current?.select();
          }}
        >
          Search another location
        </button>
      )}

      <ul
        id="meeting-address-results"
        role="listbox"
        className="group-modal__address-results"
        hidden={!suggestions.length}
      >
        {suggestions.map((place, index) => (
          <li
            key={index}
            id={`meeting-address-${index}`}
            role="option"
            aria-selected={active === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!disabled) select(place);
            }}
          >
            <strong className="group-modal__address-name">{place.name}</strong>
            <span className="group-modal__address-detail">{place.address}</span>
          </li>
        ))}
      </ul>

      <p id="meeting-location-help" className="group-modal__location-help">
        {hasLocation ? (
          <>
            Add a house, lot, or unit number to complete the address above. <br />
            Drag the pin to the exact house, or choose “Search another location” to change streets.
          </>
        ) : (
          'Type at least 3 characters and select an address. You can then add house or lot details in the same field and move the pin to the exact house.'
        )}
      </p>
      <p role="status" className="group-modal__location-help">{message}</p>

      <div
        className={`group-modal__map-shell${mapExpanded ? ' group-modal__map-shell--expanded' : ''}`}
        onClickCapture={(event) => {
          if (!mapExpanded) {
            event.stopPropagation();
            setMapExpanded(true);
          }
        }}
      >
        <button
          type="button"
          className="group-modal__map-expand"
          aria-label={mapExpanded ? 'Close enlarged map' : 'Enlarge map'}
          title={mapExpanded ? 'Close enlarged map' : 'Enlarge map'}
          onClick={(event) => {
            event.stopPropagation();
            setMapExpanded(current => !current);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {mapExpanded ? 'close_fullscreen' : 'open_in_full'}
          </span>
        </button>
        <MapContainer
          center={defaultCenter}
          zoom={13}
          className="group-modal__map"
          scrollWheelZoom={mapExpanded}
        >
          <ResizeMap expanded={mapExpanded} />
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LocationMarker
            latitude={value.latitude}
            longitude={value.longitude}
            disabled={disabled}
            onMove={move}
          />
        </MapContainer>
      </div>

      <p className="group-modal__location-help">
        {value.latitude != null && value.longitude != null
          ? `Latitude: ${Number(value.latitude).toFixed(8)} · Longitude: ${Number(value.longitude).toFixed(8)}`
          : 'No map location selected.'}
      </p>
    </div>
  );
}
