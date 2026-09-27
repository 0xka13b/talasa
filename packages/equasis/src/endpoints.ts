/**
 * Pure request builders: each maps a query to the exact path + form body Equasis
 * expects. Kept free of I/O so the wire format lives in one obvious place and can
 * be unit-tested without the network.
 */
export interface EquasisRequest {
  /** Path appended to the configured base URL, e.g. `/restricted/ShipInfo?fs=Search`. */
  path: string
  /** `application/x-www-form-urlencoded` body fields. */
  form: Record<string, string>
}

/** Search a ship by IMO. Equasis returns the full ship detail page directly. */
export function shipByImo(imo: string): EquasisRequest {
  return { path: "/restricted/ShipInfo?fs=Search", form: { P_IMO: imo } }
}

/** Fetch a ship's port-state-control (PSC) inspection history by IMO. */
export function shipInspectionsByImo(imo: string): EquasisRequest {
  return {
    path: "/restricted/ShipInspection?fs=ShipHistory",
    form: { P_IMO: imo, P_COMP: "", event: "", P_INSP: "" },
  }
}

/** Fetch a ship's name/flag/owner/manager change history by IMO. */
export function shipHistoryByImo(imo: string): EquasisRequest {
  return {
    path: "/restricted/ShipHistory?fs=ShipInspection",
    form: { P_IMO: imo, P_COMP: "", event: "", P_INSP: "" },
  }
}

/** Search companies by (partial) name. Returns a results list. */
export function companyByName(name: string): EquasisRequest {
  return {
    path: "/restricted/Search?fs=HomePage",
    form: {
      P_PAGE: "1",
      P_PAGE_COMP: "1",
      P_PAGE_SHIP: "1",
      P_ENTREE_HOME: name,
      P_ENTREE_HOME_HIDDEN: name,
      "checkbox-company": "Company",
      advancedSearch: "",
    },
  }
}

/** Search companies by Equasis company number / id. Returns a results list. */
export function companyById(id: string): EquasisRequest {
  return {
    path: "/restricted/Search?fs=Search",
    form: {
      P_PAGE: "1",
      P_PAGE_COMP: "1",
      P_PAGE_SHIP: "1",
      ongletActifSC: "ship",
      P_ENTREE_HOME_HIDDEN: id,
      P_ENTREE: id,
      Submit: "Advanced Search",
      "checkbox-companySearch": "Company",
    },
  }
}

/** Fetch a company's fleet (the vessels it owns/manages) by Equasis company number.
 * Confirmed: the company-info page's "Fleet info" button posts formCompany to
 * FleetInfo with P_PAGE + ongletActifSC hidden fields. */
export function companyFleetByImo(companyImo: string): EquasisRequest {
  return { path: "/restricted/FleetInfo?fs=CompanyInfo", form: { P_COMP: companyImo, P_PAGE: "1", ongletActifSC: "comp" } }
}
