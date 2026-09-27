import type {
  RadiusScan,
  RadiusVessel,
  RawInRadius,
  RawPosition,
  RawRadiusVessel,
  RawVesselHistory,
  RawVesselInfo,
  RawVesselLive,
  VesselIdentityCore,
  VesselLive,
  VesselPosition,
  VesselSpecs,
  VesselTrack,
} from "./types"

/** Coerce a number|string|null|undefined field to a finite number, else null. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") {
    return null
  }
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Coerce any scalar to a trimmed non-empty string, else null. */
export function str(v: unknown): string | null {
  if (v === null || v === undefined) {
    return null
  }
  const s = String(v).trim()
  return s === "" ? null : s
}

function mapIdentity(raw: {
  uuid?: unknown
  name?: unknown
  name_ais?: unknown
  mmsi?: unknown
  imo?: unknown
  country_iso?: unknown
  type?: unknown
  type_specific?: unknown
}): VesselIdentityCore {
  return {
    uuid: str(raw.uuid),
    name: str(raw.name) ?? str(raw.name_ais),
    mmsi: str(raw.mmsi),
    imo: str(raw.imo),
    countryIso: str(raw.country_iso),
    type: str(raw.type),
    typeSpecific: str(raw.type_specific),
  }
}

function mapPosition(raw: RawPosition | RawRadiusVessel | RawVesselLive): VesselPosition {
  return {
    lat: num(raw.lat),
    lon: num(raw.lon),
    speed: num(raw.speed),
    course: num(raw.course),
    heading: num(raw.heading),
    navStatus: str(raw.navigation_status),
    destination: str(raw.destination),
    epoch: num(raw.last_position_epoch),
    timeUtc: str(raw.last_position_UTC),
  }
}

export function mapVesselLive(raw: RawVesselLive): VesselLive {
  return {
    ...mapIdentity(raw),
    position: mapPosition(raw),
    destination: str(raw.destination),
    destPort: str(raw.dest_port),
    etaUtc: str(raw.eta_UTC),
    // /vessel_pro reports `current_draught`; some payloads use `draught`.
    currentDraught: num(raw.current_draught) ?? num(raw.draught),
  }
}

export function mapVesselInfo(raw: RawVesselInfo): VesselSpecs {
  return {
    ...mapIdentity(raw),
    callSign: str(raw.callsign),
    countryName: str(raw.country_name),
    grossTonnage: num(raw.gross_tonnage),
    deadweight: num(raw.deadweight),
    length: num(raw.length),
    breadth: num(raw.breadth),
    draughtMax: num(raw.draught_max),
    yearBuilt: str(raw.year_built),
    homePort: str(raw.home_port),
  }
}

export function mapVesselTrack(raw: RawVesselHistory): VesselTrack {
  return {
    ...mapIdentity(raw),
    positions: (raw.positions ?? []).map(mapPosition),
  }
}

function mapRadiusVessel(raw: RawRadiusVessel): RadiusVessel {
  return {
    ...mapIdentity(raw),
    position: mapPosition(raw),
    distanceNm: num(raw.distance),
  }
}

export function mapRadiusScan(raw: RawInRadius): RadiusScan {
  return {
    center: {
      lat: num(raw.point?.lat),
      lon: num(raw.point?.lon),
      radiusNm: num(raw.point?.radius),
    },
    total: num(raw.total),
    vessels: (raw.vessels ?? []).map(mapRadiusVessel),
  }
}
