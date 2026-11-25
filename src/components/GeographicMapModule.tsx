import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Globe2, MapPin, Plus, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Dataset, GeographicSite } from '../types/edna';

export const GeographicMapModule: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [sites, setSites] = useState<GeographicSite[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedSite, setSelectedSite] = useState<GeographicSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [countryFilter, setCountryFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Add sampling location modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDatasetId, setNewDatasetId] = useState('');
  const [newSampleCode, setNewSampleCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newLat, setNewLat] = useState('');
  const [newLon, setNewLon] = useState('');

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (countryFilter) params.set('country', countryFilter);
      if (regionFilter) params.set('region', regionFilter);
      if (sampleTypeFilter !== 'All') params.set('sampleType', sampleTypeFilter);
      if (dateFilter) params.set('collectionDate', dateFilter);
      if (searchFilter) params.set('search', searchFilter);

      const [sitesRes, dsRes] = await Promise.all([
        apiFetch<{ sites: GeographicSite[] }>(`/api/geography/sites?${params.toString()}`),
        apiFetch<{ datasets: Dataset[] }>('/api/datasets'),
      ]);
      setSites(sitesRes.sites);
      setDatasets(dsRes.datasets);
      if (dsRes.datasets.length > 0 && !newDatasetId) {
        setNewDatasetId(dsRes.datasets[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load geographic sampling locations.');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, regionFilter, sampleTypeFilter, dateFilter, searchFilter, newDatasetId]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [20, 10],
      zoom: 2,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Sync markers whenever sites change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (sites.length === 0) return;

    const bounds: Array<[number, number]> = [];
    sites.forEach((site) => {
      bounds.push([site.latitude, site.longitude]);
      const marker = L.circleMarker([site.latitude, site.longitude], {
        radius: Math.max(7, Math.min(16, 6 + site.richness * 1.1)),
        fillColor: '#18A999',
        color: '#174D35',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 190px;">
          <div style="font-weight: 700; color: #174D35; font-size: 13px;">${site.samplingLocation}</div>
          <div style="font-size: 11px; color: #555; margin-top: 2px;">${site.sampleCode} · ${site.sampleType}</div>
          <div style="font-size: 11px; margin-top: 6px; font-family: monospace;">
            GPS: ${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}<br/>
            Richness (S): ${site.richness} · Shannon H': ${site.shannonIndex.toFixed(2)}
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.on('click', () => setSelectedSite(site));
      marker.addTo(layer);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 10);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [sites]);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/geography/sites', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: newDatasetId,
          sampleCode: newSampleCode,
          samplingLocation: newLocation,
          collectionDate: newDate,
          latitude: Number(newLat),
          longitude: Number(newLon),
        }),
      });
      setShowAddModal(false);
      setNewSampleCode('');
      setNewLocation('');
      setNewLat('');
      setNewLon('');
      await loadSites();
    } catch (err: any) {
      setError(err.message || 'Failed to add sampling site.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">
            Geographical Biodiversity Visualization
          </h1>
          <p className="text-sm text-[#25332C]/75">
            Explore GPS-referenced eDNA sampling points, filter by habitat or region, and compare
            taxonomic composition across sites.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={datasets.length === 0}
          className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Sampling Location
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-[#174D35]/12 p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search site or dataset..."
          className="px-3 py-2 text-xs border border-[#174D35]/20 rounded-lg"
        />
        <input
          type="text"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          placeholder="Filter by Country"
          className="px-3 py-2 text-xs border border-[#174D35]/20 rounded-lg"
        />
        <input
          type="text"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          placeholder="Filter by Region"
          className="px-3 py-2 text-xs border border-[#174D35]/20 rounded-lg"
        />
        <select
          value={sampleTypeFilter}
          onChange={(e) => setSampleTypeFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#174D35]/20 rounded-lg bg-white"
        >
          <option value="All">All Sample Types</option>
          <option value="Water">Water</option>
          <option value="Soil">Soil</option>
          <option value="Sediment">Sediment</option>
          <option value="Air">Air</option>
          <option value="Biofilm">Biofilm</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#174D35]/20 rounded-lg"
        />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Map + Selected Site Detail Split */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#174D35]/12 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-[440px]" />
        </div>

        <div className="lg:col-span-4 bg-white rounded-xl border border-[#174D35]/12 p-5 flex flex-col justify-between">
          {selectedSite ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono text-[#18A999]">
                  {selectedSite.sampleCode} · {selectedSite.sampleType}
                </div>
                <h2 className="mt-1 text-lg font-bold text-[#174D35]">
                  {selectedSite.samplingLocation}
                </h2>
                <div className="mt-1 text-xs font-mono tabular-nums text-[#25332C]/65">
                  GPS: {selectedSite.latitude.toFixed(4)}, {selectedSite.longitude.toFixed(4)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#174D35]/10 text-center">
                <div className="p-2.5 rounded-lg bg-[#F6FAF7]">
                  <div className="text-[11px] text-[#25332C]/60">Richness</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#174D35]">
                    {selectedSite.richness}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F6FAF7]">
                  <div className="text-[11px] text-[#25332C]/60">Shannon H&apos;</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#174D35]">
                    {selectedSite.shannonIndex.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F6FAF7]">
                  <div className="text-[11px] text-[#25332C]/60">Simpson</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#18A999]">
                    {selectedSite.simpsonIndex.toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#174D35] mb-1.5">
                  Detected Taxa at Site
                </h3>
                {selectedSite.topTaxa.length === 0 ? (
                  <p className="text-xs text-[#25332C]/65">No assigned taxa for this site yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs italic text-[#25332C]/85 max-h-40 overflow-y-auto">
                    {selectedSite.topTaxa.map((sp) => (
                      <li key={sp} className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#269B68] shrink-0" />
                        <span>{sp}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="text-xs text-[#25332C]/65 pt-2 border-t border-[#174D35]/10">
                Dataset: <span className="font-medium text-[#174D35]">{selectedSite.datasetName}</span>
                <br />
                Collected: <span className="font-mono">{selectedSite.collectionDate}</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Globe2 className="w-8 h-8 text-[#174D35]/40 mb-3" />
              <p className="text-sm font-semibold text-[#174D35]">
                {loading
                  ? 'Loading GPS sampling sites...'
                  : sites.length === 0
                    ? 'No georeferenced sampling sites yet'
                    : 'Select a map marker'}
              </p>
              <p className="mt-1 text-xs text-[#25332C]/65">
                {sites.length === 0
                  ? 'Upload a dataset with GPS coordinates or add a sampling location above.'
                  : 'Click any marker on the map or a row below to inspect sample-specific taxonomic composition.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Site Comparison Table */}
      {sites.length > 0 && (
        <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
              <tr>
                <th className="py-2.5 px-4">Sample Code</th>
                <th className="py-2.5 px-4">Sampling Location</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Coordinates</th>
                <th className="py-2.5 px-4 text-right">Richness</th>
                <th className="py-2.5 px-4 text-right">Shannon H&apos;</th>
                <th className="py-2.5 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#174D35]/10">
              {sites.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedSite(s)}
                  className="hover:bg-[#F6FAF7] cursor-pointer"
                >
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#174D35]">
                    {s.sampleCode}
                  </td>
                  <td className="py-2.5 px-4">{s.samplingLocation}</td>
                  <td className="py-2.5 px-4">{s.sampleType}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums">
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right">{s.richness}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right">
                    {s.shannonIndex.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums">{s.collectionDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSite}
            className="bg-white rounded-xl border border-[#174D35]/15 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#174D35]/10 pb-3">
              <h3 className="text-base font-bold text-[#174D35]">Add Sampling Site</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#25332C]/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Dataset *</label>
              <select
                required
                value={newDatasetId}
                onChange={(e) => setNewDatasetId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fileName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Sample Code *</label>
                <input
                  type="text"
                  required
                  value={newSampleCode}
                  onChange={(e) => setNewSampleCode(e.target.value)}
                  placeholder="SITE_04"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Collection Date *</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Sampling Location *</label>
              <input
                type="text"
                required
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="West Estuary Reed Bed"
                className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  placeholder="1.4481"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  placeholder="103.7292"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-medium text-[#25332C]/70 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#174D35] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Site
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
