# AIS behaviour and satellite verification

AIS (Automatic Identification System) is the position signal ships broadcast.
Talasa uses 90 days of a vessel's AIS history to spot patterns associated with
sanctions evasion. It can then check a suspected ship-to-ship (STS) transfer
against Sentinel satellite imagery on demand.

Everything here is **suspected, never confirmed**. The detectors flag patterns
worth an analyst's attention.

## Data

The `ais` stage of a vessel screening calls Datalastic `/vessel_history` for
the last `VESSEL_AIS_HISTORY_DAYS` days (default 90). Datalastic charges about
one credit per day per vessel, so a default screening costs about 90 credits.

**When the stage is skipped.** If no `DATALASTIC_API_KEY` is set, or Datalastic
has no track for the vessel, the stage records an `ais_history` data gap and
the screening continues. HTTP errors fail the stage, which is also a data gap.

**Positions are not stored.** The raw track is analysed in memory and
discarded. Only the detected events and counts are stored.

## Detectors

The detectors are pure functions in `packages/shared/src/ais.ts`. First they
drop fixes without coordinates or a timestamp, sort by time and remove
duplicate timestamps.

| Event | Rule (default threshold) | Meaning |
|---|---|---|
| **Dark gap** | Two consecutive fixes at least **6 hours** apart | The transponder was off or out of coverage. The report shows the duration, the distance covered, and the implied speed across the gap |
| **STS candidate** | Speed at or below **0.7 knots** for at least **3 hours**, and not reported as moored or at anchor | Loitering at sea, consistent with a ship-to-ship transfer. The other vessel is not identified |
| **Speed anomaly** | Implied speed between consecutive fixes above **30 knots** | Physically implausible movement, possibly spoofed positions |

- **Vessel types:** STS candidates are suppressed for yachts, pleasure craft,
  sailing vessels and fishing vessels, which stop at sea for ordinary reasons.
- **Thresholds:** they are constants (`DEFAULT_AIS_THRESHOLDS`), not
  environment variables.

### High-risk zones

A dark gap or STS candidate inside one of these coarse bounding boxes scores
higher (see [scoring.md](scoring.md)):
- Novorossiysk
- Kerch Strait
- Gulf of Finland
- Laconian Gulf
- Fujairah OPL
- Singapore Strait / Malaysia
- Nakhodka
- Off Venezuela
- Strait of Gibraltar

They are defined in `HIGH_RISK_STS_ZONES`. They are deliberately rough: a
corroborating signal, not a geofence.

### What the report keeps

- **Which events:** up to 25 dark gaps, STS candidates and speed anomalies.
  Events in high-risk zones come first.
- **Locations:**
  - a dark gap is placed at its start
  - an STS candidate at the centre of the loiter
  - a speed anomaly has no location
- **Place labels:** each located event gets an offline label: the nearest of
  about 1,000 ports with distance and bearing, the named sea area, and an
  approximate EEZ based on distance to the nearest port. With
  `GOOGLE_MAPS_API_KEY` set, it also gets a reverse-geocoded place name.

## In the report

The **AIS behaviour** tab shows:
- summary counts
- a transmission timeline built from the events
- the event list
- a map, when `VITE_GOOGLE_MAPS_API_KEY` is set

The map plots **event points only**, not the vessel's track, because the track
isn't stored. Marker colours:
- amber: dark gaps
- red: STS candidates
- violet: speed anomalies
- thick red outline: events inside high-risk zones

The PDF includes a static map of the same points.

## Satellite verification (Sentinel)

Each STS candidate in the event list has a **Verify with Sentinel-1 satellite**
action. It is on demand, never part of the pipeline, and it does not change the
score.

It needs a free Copernicus Data Space account: set `CDSE_CLIENT_ID` and
`CDSE_CLIENT_SECRET`. Without them the API returns 503 for this action.

How it works (`packages/copernicus`, `apps/api/src/services/sts-sar.ts`):

1. **Vessel size.** Look up the vessel's length and beam with Datalastic
   `/vessel_info`.
2. **Scenes.** Search the free STAC catalogue for Sentinel-1 radar scenes over
   a ±5 km area during the loiter window. Try up to 4 scenes, newest first, and
   skip scenes that cover less than half the area.
3. **Detect hulls.** Find bright targets in the radar image, using a threshold
   of mean + 6 standard deviations.
4. **Classify:**
   - `sts_contact`: a second hull within 300 m of the matched vessel
   - `beam_anomaly`: the detected width is more than 1.6× the registered beam,
     which may mean two hulls side by side
   - `vessel_confirmed`: a single hull within 500 m of the loiter position
   - `no_detection`: nothing within 500 m
5. **Image chip.** Render a 768 px chip. There are three palettes, `terrain`,
   `twopol` and `optical`. The `optical` palette uses the least cloudy
   Sentinel-2 scene instead of radar.

Each result is cached per event and palette (`sar_verifications` table),
because image processing uses Copernicus processing units, a monthly quota.

The Ask Agent can read a cached chip with a vision model, through its
`analyze_sts_satellite` tool (see [ask-agent.md](ask-agent.md)).

## Known limitations

- **No port calls:** loiters at anchor or moored are discarded, and port calls
  are not detected from AIS.
- **Single vessel only:** there is no multi-vessel matching, so the other
  vessel in an STS transfer is never identified from AIS.
- **Misleading label:** the `ais.dark_gap_high_risk` driver also fires when
  only an STS candidate, not a gap, is in a high-risk zone.
- **Cache key:** it is the event's position in the capped event list. If a
  report is regenerated and the list reorders, a cached verification can
  attach to a different event.
- **Monitors:** re-running AIS on a schedule reports count changes as older
  events leave the 90-day window, even when the vessel's behaviour hasn't
  changed.
