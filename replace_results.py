path = r'C:\Users\Admin\Desktop\App\merosadak\src\components\RoutePlanner.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "{sections.isExpanded('results') && ("
end_marker = "          )}\n\n          {/* 6. Mode first, then along-route modules (driver vs passenger). */}"

start_idx = content.index(start_marker)
end_idx = content.index(end_marker, start_idx) + len(end_marker)

new_block = """{sections.isExpanded('results') && (
          <div
            id="route-results-panel"
            key={`route-results-panel-${calcKey}-${routePlan.id}`}
            className="p-3 sm:p-4 space-y-2 sm:space-y-2.5 animate-fade-in-smooth transition-all duration-500 ease-out max-w-full"
         >
            {/* 1. ROUTE HEADER: From → To */}
            <div className="flex items-center justify-between gap-2 px-2 py-2 border border-slate-800/60 bg-slate-900/40 rounded-xl">
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">From</span>
                <span className="text-sm font-bold text-white truncate">
                  {routePlan.origin.name || routePlan.origin.id}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">→</span>
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">To</span>
                <span className="text-sm font-bold text-white truncate">
                  {routePlan.destination.name || routePlan.destination.id}
                </span>
              </div>
              <button
                type="button"
                onClick={handleEditLocations}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold shrink-0"
                title="Change origin or destination"
              >
                Change
              </button>
            </div>

            {/* 2. KEY METRICS: one compact line — distance, time, cost, safety */}
            <div className="px-2 py-2 border-b border-slate-800/60 bg-slate-900/40 rounded-xl">
              <div className="flex flex-wrap items-center gap-3 gap-y-1 text-xs font-mono">
                <span className="flex items-center space-x-1 text-white font-bold" title="Distance">
                  <Compass className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{routePlan.totalDistanceKm} km</span>
                </span>
                <span className="flex items-center space-x-1 text-cyan-400 font-bold" title="Time">
                  <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>
                    {Math.floor(routePlan.estimatedTimeMinutes / 60)}h{' '}
                    {routePlan.estimatedTimeMinutes % 60}m
                  </span>
                </span>
                <span className="flex items-center space-x-1 text-amber-300 font-bold" title="Est. Cost">
                  <Fuel className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Rs {estimatedTripCostNpr.toLocaleString()}</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-400 font-bold" title="Safety">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{routePlan.roadConditionScore}</span>
                </span>
              </div>
            </div>

            {/* 3. PRIMARY ACTIONS: Start trip + View on map */}
            <div className="px-2 py-2.5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setTravelPlanView('steps');
                  setActiveModuleTab('travel_plan');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/20 transition"
                id="btn-start-trip"
              >
                <Navigation className="w-4 h-4" />
                <span>Start Trip</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onToggleMapFull) {
                    onToggleMapFull();
                  } else if (onViewOnMap) {
                    onViewOnMap();
                  }
                  const mapElem = document.getElementById('nepal-gis-canvas');
                  if (mapElem) {
                    mapElem.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 text-sm font-bold transition"
                id="btn-view-on-map"
              >
                <Navigation className="w-4 h-4" />
                <span>View on Map</span>
              </button>
            </div>

            {/* 4. SECONDARY ACTIONS: Change location / New route / Share */}
            <div className="px-2 py-1 flex flex-wrap gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={handleEditLocations}
                className="px-2.5 py-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Change route origin or destination"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span className="ml-1">Change Location</span>
              </button>
              <button
                type="button"
                onClick={handleNewRoute}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Plan a new route"
              >
                <ArrowUpDown className="w-3 h-3 shrink-0" />
                <span className="ml-1 hidden sm:inline">New Route</span>
              </button>
              <button
                type="button"
                onClick={() => onShareTrip?.()}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Share this trip"
              >
                <Share2 className="w-3 h-3 text-emerald-400 shrink-0" />
              </button>
            </div>

            {/* 5. EXPAND / REDUCE full report toggle */}
            <button
              type="button"
              onClick={() => setIsReportExpanded(!isReportExpanded)}
              className="w-full px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
            >
              {isReportExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 text-emerald-400" />
                  <span>Reduce full report</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 text-emerald-400" />
                  <span>Expand full report</span>
                </>
              )}
            </button>

            {/* 6. EXPANDED FULL REPORT CONTENT (one view at a time) */}
            {isReportExpanded && (
              <>
                {routePlan.allRouteOptions && routePlan.allRouteOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setResultsViewMode(resultsViewMode === 'overview' ? 'comparison' : 'overview')
                    }
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      resultsViewMode === 'comparison'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                    }`}
                    title="Toggle route alternatives comparison"
                  >
                    <Layers className="w-3 h-3" />
                    <span>{resultsViewMode === 'overview' ? 'Compare' : 'Overview'}</span>
                    <span className="text-[10px] opacity-70">
                      ({routePlan.allRouteOptions.length} routes)
                    </span>
                  </button>
                )}

                {resultsViewMode === 'comparison' && (
                  <RouteComparisonView
                    activePlan={routePlan}
                    allOptions={routePlan.allRouteOptions || [routePlan]}
                    selectedRouteId={routePlan.id}
                    vehicle={vehicle}
                    onSelectRoute={(opt) => {
                      setRoutePlan(opt);
                      setPreference(opt.preference);
                      onRouteCalculated(opt);
                    }}
                    onViewOnMap={onViewOnMap}
                  />
                )}

                {resultsViewMode === 'overview' && (
                  <UnifiedRouteReport
                    route={routePlan}
                    distanceKm={routePlan.totalDistanceKm}
                    distanceSource="dor_gis_route"
                    distanceEvidence="route_graph"
                    distanceSourceUrl="https://dor.gov.np"
                    distanceSourceDescription="DoR Nepal highway GIS route geometry and certified road network."
                    vehicleLabel={VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label}
                    preferenceLabel={preference.replace('_', ' ')}
                    onPrint={() => window.print()}
                    onShare={() => onShareTrip?.()}
                    userIdentity={{
                      name: user?.displayName || undefined,
                      email: user?.email || undefined,
                    }}
                    fuelBasis={buildFuelBasis()}
                    embedded
                    showElevationProfile
                    simulationControls={simulationControls}
                    onViewOnMap={onViewOnMap}
                  />
                )}
              </>
            )}
"""

content = content[:start_idx] + new_block + content[end_idx:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Replacement done')
