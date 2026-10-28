/**
 * DRUG INFORMATION SERVICE — drugInfo.service.js
 * ================================================
 * "Drug information management": a local reference of common medicines
 * (uses, side effects, warnings, known interactions) and an interaction
 * check across a patient's active medications. Rule-based, offline — no
 * external API key needed.
 */

const drugs = require("../../data/drugs.json");

const normalise = (s) => String(s || "").trim().toLowerCase();

const findDrug = (name) => {
  const n = normalise(name);
  if (!n) return null;
  return (
    drugs.find((d) => normalise(d.name) === n || d.aliases.some((a) => normalise(a) === n)) ||
    drugs.find((d) => n.includes(normalise(d.name)) || d.aliases.some((a) => n.includes(normalise(a)))) ||
    null
  );
};

const searchDrugs = (query) => {
  const q = normalise(query);
  if (!q) return drugs.map((d) => ({ name: d.name, class: d.class, uses: d.uses }));
  return drugs
    .filter((d) => normalise(d.name).includes(q) || d.aliases.some((a) => normalise(a).includes(q)) || normalise(d.class).includes(q))
    .map((d) => ({ name: d.name, class: d.class, uses: d.uses }));
};

/** Check pairs of medications for known interactions. */
const checkInteractions = (medicineNames) => {
  const resolved = medicineNames.map((name) => ({ name, drug: findDrug(name) }));
  const warnings = [];
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i];
      const b = resolved[j];
      if (!a.drug || !b.drug) continue;
      const aHits = a.drug.interactions.some((x) => normalise(x).includes(normalise(b.drug.name)) || b.drug.aliases.some((al) => normalise(x).includes(normalise(al))));
      const bHits = b.drug.interactions.some((x) => normalise(x).includes(normalise(a.drug.name)) || a.drug.aliases.some((al) => normalise(x).includes(normalise(al))));
      if (aHits || bHits) {
        warnings.push({
          medications: [a.name, b.name],
          severity: /warfarin|digoxin|lithium|insulin/i.test(`${a.drug.name} ${b.drug.name}`) ? "high" : "moderate",
          message: `${a.drug.name} and ${b.drug.name} are listed as interacting. Ask the prescribing doctor or pharmacist before combining them.`,
        });
      }
      // Same drug class duplicated (e.g. two cholinesterase inhibitors)
      if (a.drug.class === b.drug.class && /inhibitor|statin|nsaid|antiplatelet|benzodiazepine/i.test(a.drug.class) && a.drug.name !== b.drug.name) {
        warnings.push({
          medications: [a.name, b.name],
          severity: "moderate",
          message: `${a.drug.name} and ${b.drug.name} belong to the same class (${a.drug.class}). Taking both is usually not intended.`,
        });
      }
    }
  }
  return {
    checked: resolved.length,
    recognised: resolved.filter((r) => r.drug).map((r) => r.drug.name),
    unrecognised: resolved.filter((r) => !r.drug).map((r) => r.name),
    warnings,
  };
};

module.exports = { findDrug, searchDrugs, checkInteractions, allDrugs: () => drugs };
