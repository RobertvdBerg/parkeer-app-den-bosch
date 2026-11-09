const fs = require("fs");
const vm = require("vm");

const elementStub = () => ({
  addEventListener: () => {},
  appendChild: () => {},
  classList: { toggle: () => {}, add: () => {} },
  style: {},
  set textContent(v) {},
  set innerHTML(v) {},
  get value() { return ""; }
});

const sandbox = {
  document: {
    getElementById: () => elementStub(),
    createElement: () => elementStub()
  },
  fetch: () => Promise.reject(new Error("offline in test")),
  setInterval: () => {},
  console
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("fallback-data.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("app.js", "utf8"), sandbox);

const staticSample = {
  parkingFacilityInformation: {
    name: "parkeergarage Forum",
    specifications: [{ chargingPointCapacity: 10, disabledAccess: true, minimumHeightInMeters: 2.0, usage: "Garage parkeren" }],
    operator: { name: "Groningen" },
    accessPoints: [{
      accessPointLocation: [{ coordinatesType: "WGS84", latitude: 53.219207, longitude: 6.57081 }],
      accessPointAddress: { streetName: "Schoolstraat", houseNumber: "16", zipcode: "9712JS", city: "Groningen" }
    }]
  }
};
const dynamicSample = {
  parkingFacilityDynamicInformation: {
    facilityActualStatus: { open: true, full: false, parkingCapacity: 335, vacantSpaces: 178, lastUpdated: 1794256904 }
  }
};

const f = sandbox.mergeFacility({ name: "parkeergarage Forum (Groningen)" }, staticSample, dynamicSample);
const assert = require("assert");
assert.strictEqual(f.name, "parkeergarage Forum");
assert.strictEqual(f.vacantSpaces, 178);
assert.strictEqual(f.capacity, 335);
assert.deepEqual(sandbox.statusOf(f), { label: "Vrij", cls: "vrij" });
assert.strictEqual(sandbox.occupancyPct(f), 47);
assert.ok(sandbox.routeUrl(f).includes("53.219207,6.57081"));
assert.strictEqual(sandbox.statusOf(sandbox.mergeFacility({}, staticSample, {
  parkingFacilityDynamicInformation: { facilityActualStatus: { open: true, full: true, parkingCapacity: 335, vacantSpaces: 0 } }
})).label, "Vol");
assert.strictEqual(sandbox.statusOf(sandbox.mergeFacility({}, staticSample, {
  parkingFacilityDynamicInformation: { facilityActualStatus: { open: false, parkingCapacity: 335, vacantSpaces: 100 } }
})).label, "Gesloten");
assert.ok(sandbox.isDenBoschName("Parkeergarage Wolvenhoek ('s-Hertogenbosch)"));
assert.ok(!sandbox.isDenBoschName("parkeergarage Forum (Groningen)"));
assert.strictEqual(vm.runInContext("FALLBACK_FACILITIES.length", sandbox), 12);
console.log("Alle parse-tests geslaagd.");
