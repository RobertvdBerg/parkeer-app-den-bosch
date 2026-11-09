const NPR_INDEX_URL = "https://npropendata.rdw.nl/parkingdata/v2/";
const CITY_PATTERN = /(s[-\s]?hertogenbosch|den[\s-]?bosch)/i;
const REFRESH_INTERVAL_MS = 30000;

const cardsEl = document.getElementById("cards");
const mapEl = document.getElementById("map");

let map = null;
let markerLayer = null;

function initMap() {
  if (typeof L === "undefined" || !mapEl) return;
  map = L.map("map").setView([51.69, 5.31], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>-bijdragers"
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function statusColor(st) {
  if (st.cls === "vrij") return "#2ecc71";
  if (st.cls === "bijna-vol") return "#f39c12";
  if (st.cls === "vol") return "#e74c3c";
  return "#7f8c9b";
}

function renderMap() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  const bounds = [];
  for (const f of facilities) {
    if (f.latitude == null || f.longitude == null) continue;
    const st = statusOf(f);
    const label = f.vacantSpaces != null ? String(f.vacantSpaces) : "?";
    const icon = L.divIcon({
      className: "",
      html: "<div class=\"marker-num\" style=\"background:" + statusColor(st) + "\">" + label + "</div>",
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const popup =
      "<div class=\"popup-name\">" + f.name + "</div>" +
      "<div class=\"popup-status\" style=\"color:" + statusColor(st) + "\">" + st.label + "</div>" +
      (f.vacantSpaces != null
        ? "<div>" + f.vacantSpaces + " vrije plekken" + (f.capacity ? " van " + f.capacity : "") + "</div>"
        : "<div>bezetting onbekend</div>") +
      (f.address ? "<div class=\"popup-meta\">" + f.address + "</div>" : "") +
      (f.lastUpdated ? "<div class=\"popup-meta\">live: " + f.lastUpdated.toLocaleTimeString("nl-NL") + "</div>" : "") +
      (routeUrl(f) ? "<div><a href=\"" + routeUrl(f) + "\" target=\"_blank\" rel=\"noopener\">Route plannen →</a></div>" : "");
    L.marker([f.latitude, f.longitude], { icon: icon }).bindPopup(popup).addTo(markerLayer);
    bounds.push([f.latitude, f.longitude]);
  }
  if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
}
const statusEl = document.getElementById("statusline");
const filterEl = document.getElementById("filter");
const sortEl = document.getElementById("sort");
const refreshBtn = document.getElementById("refresh");

let facilities = [];
let usingFallback = false;
let lastFetchOk = null;

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", Boolean(isError));
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status + " voor " + url);
    return await res.json();
  } catch (directErr) {
    const res = await fetch("proxy.php?url=" + encodeURIComponent(url), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status + " via proxy voor " + url);
    return await res.json();
  }
}

function isDenBoschName(name) {
  return CITY_PATTERN.test(name || "");
}

function parseStatic(info) {
  const p = (info && info.parkingFacilityInformation) || {};
  const spec = (p.specifications && p.specifications[0]) || {};
  const access = (p.accessPoints && p.accessPoints[0]) || {};
  const loc = (access.accessPointLocation && access.accessPointLocation[0]) || {};
  const addr = access.accessPointAddress || {};
  const address = [addr.streetName, addr.houseNumber, addr.zipcode, addr.city]
    .filter(Boolean).join(" ");
  return {
    name: p.name || p.description || "Onbekende locatie",
    type: spec.usage || "Parkeervoorziening",
    address: address,
    latitude: loc.latitude != null ? loc.latitude : null,
    longitude: loc.longitude != null ? loc.longitude : null,
    capacity: spec.capacity != null ? spec.capacity : null,
    chargingPoints: spec.chargingPointCapacity != null ? spec.chargingPointCapacity : null,
    disabledAccess: Boolean(spec.disabledAccess),
    minHeight: spec.minimumHeightInMeters != null ? spec.minimumHeightInMeters : null,
    operator: p.operator && p.operator.name ? p.operator.name : null
  };
}

function parseDynamic(info) {
  const d = (info && info.parkingFacilityDynamicInformation) || {};
  const s = d.facilityActualStatus || {};
  return {
    open: s.open != null ? Boolean(s.open) : null,
    full: s.full != null ? Boolean(s.full) : null,
    capacity: s.parkingCapacity != null ? s.parkingCapacity : null,
    vacantSpaces: s.vacantSpaces != null ? s.vacantSpaces : null,
    lastUpdated: s.lastUpdated ? new Date(s.lastUpdated * 1000) : null
  };
}

function mergeFacility(entry, staticInfo, dynamicInfo) {
  const s = staticInfo ? parseStatic(staticInfo) : null;
  const d = dynamicInfo ? parseDynamic(dynamicInfo) : null;
  const name = (s && s.name) || entry.name || "Onbekende locatie";
  const cityOk = s ? CITY_PATTERN.test(s.address || "") : isDenBoschName(entry.name);
  return {
    name: name,
    type: (s && s.type) || "Parkeervoorziening",
    address: (s && s.address) || "",
    latitude: s && s.latitude != null ? s.latitude : null,
    longitude: s && s.longitude != null ? s.longitude : null,
    capacity: (d && d.capacity) || (s && s.capacity) || null,
    vacantSpaces: d ? d.vacantSpaces : null,
    open: d && d.open != null ? d.open : null,
    full: d && d.full != null ? d.full : null,
    lastUpdated: d ? d.lastUpdated : null,
    fallback: false,
    cityOk: cityOk
  };
}

async function loadLive() {
  const index = await fetchJson(NPR_INDEX_URL);
  const entries = (index && index.ParkingFacilities) || [];
  const candidates = entries.filter((e) => isDenBoschName(e.name));
  const merged = [];
  for (const entry of candidates) {
    try {
      const staticInfo = entry.staticDataUrl ? await fetchJson(entry.staticDataUrl) : null;
      const dynamicInfo = entry.dynamicDataUrl ? await fetchJson(entry.dynamicDataUrl) : null;
      const f = mergeFacility(entry, staticInfo, dynamicInfo);
      if (f.cityOk || isDenBoschName(f.name) || isDenBoschName(f.address)) merged.push(f);
    } catch (err) {
      merged.push(mergeFacility(entry, null, null));
    }
  }
  return merged;
}

function statusOf(f) {
  if (f.open === false) return { label: "Gesloten", cls: "gesloten" };
  if (f.vacantSpaces == null) return { label: "Onbekend", cls: "onbekend" };
  if (f.vacantSpaces === 0 || f.full === true) return { label: "Vol", cls: "vol" };
  const cap = f.capacity || 0;
  if (cap > 0 && f.vacantSpaces / cap <= 0.1) return { label: "Bijna vol", cls: "bijna-vol" };
  return { label: "Vrij", cls: "vrij" };
}

function occupancyPct(f) {
  if (!f.capacity || f.vacantSpaces == null) return null;
  return Math.max(0, Math.min(100, Math.round(((f.capacity - f.vacantSpaces) / f.capacity) * 100)));
}

function matchesFilter(f) {
  const q = filterEl.value.trim().toLowerCase();
  if (!q) return true;
  return (f.name + " " + f.address + " " + f.type).toLowerCase().includes(q);
}

function sortFacilities(list) {
  const mode = sortEl.value;
  const copy = list.slice();
  if (mode === "naam") {
    copy.sort((a, b) => a.name.localeCompare(b.name, "nl"));
  } else if (mode === "bezetting") {
    copy.sort((a, b) => {
      const pa = occupancyPct(a), pb = occupancyPct(b);
      if (pa == null && pb == null) return a.name.localeCompare(b.name, "nl");
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
  } else {
    copy.sort((a, b) => {
      const va = a.vacantSpaces != null ? a.vacantSpaces : -1;
      const vb = b.vacantSpaces != null ? b.vacantSpaces : -1;
      if (va !== vb) return vb - va;
      return a.name.localeCompare(b.name, "nl");
    });
  }
  return copy;
}

function routeUrl(f) {
  if (f.latitude == null || f.longitude == null) return null;
  return "https://www.google.com/maps/dir/?api=1&destination=" + f.latitude + "," + f.longitude;
}

function render() {
  renderMap();
  const list = sortFacilities(facilities.filter(matchesFilter));
  cardsEl.innerHTML = "";
  if (list.length === 0) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = "Geen locaties gevonden voor deze filter.";
    cardsEl.appendChild(div);
    return;
  }
  for (const f of list) {
    const st = statusOf(f);
    const pct = occupancyPct(f);
    const card = document.createElement("article");
    card.className = "card";

    const type = document.createElement("span");
    type.className = "type";
    type.textContent = f.type;
    card.appendChild(type);

    const h3 = document.createElement("h3");
    h3.textContent = f.name;
    card.appendChild(h3);

    const badge = document.createElement("span");
    badge.className = "badge " + st.cls;
    badge.textContent = st.label;
    card.appendChild(badge);

    const free = document.createElement("div");
    free.className = "free";
    if (f.vacantSpaces != null) {
      free.textContent = f.vacantSpaces + " ";
      const small = document.createElement("small");
      small.textContent = "vrije plekken" + (f.capacity ? " van " + f.capacity : "");
      free.appendChild(small);
    } else {
      free.textContent = "—";
      const small = document.createElement("small");
      small.textContent = f.fallback ? "geen live data beschikbaar" : "bezetting onbekend";
      free.appendChild(small);
    }
    card.appendChild(free);

    if (pct != null) {
      const bar = document.createElement("div");
      bar.className = "bar" + (pct >= 90 ? " high" : pct >= 70 ? " mid" : "");
      const fill = document.createElement("div");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      card.appendChild(bar);
    }

    if (f.address) {
      const addr = document.createElement("div");
      addr.className = "address";
      addr.textContent = f.address;
      card.appendChild(addr);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    const bits = [];
    if (f.lastUpdated) bits.push("Live bijgewerkt: " + f.lastUpdated.toLocaleTimeString("nl-NL"));
    if (f.chargingPoints) bits.push(f.chargingPoints + " laadpunten");
    if (f.disabledAccess) bits.push("toegankelijk voor gehandicapten");
    if (f.minHeight) bits.push("max. hoogte " + f.minHeight + " m");
    if (f.operator) bits.push("beheerder: " + f.operator);
    if (f.fallback) bits.push("voorbeeldweergave (statische data)");
    meta.textContent = bits.join(" · ");
    card.appendChild(meta);

    const url = routeUrl(f);
    if (url) {
      const a = document.createElement("a");
      a.className = "route";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Route plannen →";
      card.appendChild(a);
    }

    cardsEl.appendChild(card);
  }
}

async function refresh() {
  setStatus("Live data ophalen bij RDW Open Parkeerdata…", false);
  try {
    const live = await loadLive();
    if (live.length === 0) throw new Error("Geen locaties voor 's-Hertogenbosch gevonden in de index");
    facilities = live;
    usingFallback = false;
    lastFetchOk = new Date();
    setStatus(
      "Live data geladen om " + lastFetchOk.toLocaleTimeString("nl-NL") +
      " · " + live.length + " locaties · verversen elke 30 sec.",
      false
    );
  } catch (err) {
    facilities = FALLBACK_FACILITIES;
    usingFallback = true;
    lastFetchOk = new Date();
    setStatus(
      "Live data niet bereikbaar (" + err.message + ") — statische voorbeeldweergave actief. Probeert het elke 30 sec. opnieuw.",
      true
    );
  }
  render();
}

filterEl.addEventListener("input", render);
sortEl.addEventListener("change", render);
refreshBtn.addEventListener("click", refresh);

initMap();
refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
