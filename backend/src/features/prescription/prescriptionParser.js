/**
 * PRESCRIPTION PARSER — prescriptionParser.js
 * =============================================
 * FR11: "generate medication plans automatically from text-based
 * prescriptions". A rule-based parser (the project document chooses rules
 * now, machine learning later) that turns lines such as
 *
 *   Donepezil 10mg once daily at night for 30 days
 *   Tab. Metformin 500 mg BD after meals x 2 weeks
 *   Memantine 5mg twice a day (morning and evening)
 *   Aspirin 75mg OD morning
 *
 * into { medicineName, dosage, frequency, timeOfDay[], durationDays,
 * instructions, confidence }.
 */

const TIME_WORDS = [
  [/\b(morning|breakfast|a\.?m\.?|am\b|mane|qam|sunrise)\b/i, "Morning"],
  [/\b(afternoon|noon|lunch|midday)\b/i, "Afternoon"],
  [/\b(evening|dinner|supper|p\.?m\.?|pm\b)\b/i, "Evening"],
  [/\b(night|bedtime|hs\b|nocte|qhs|before bed|at bed|sleep)\b/i, "Night"],
];

// Latin / clinical abbreviations → times per day
const FREQ_PATTERNS = [
  [/\b(four times (a|per) day|4 times (a|per) day|qid|q\.i\.d\.?|4x\/?day|4 x daily)\b/i, 4],
  [/\b(three times (a|per) day|thrice (a|per) day|3 times (a|per) day|tid|t\.i\.d\.?|tds|3x\/?day|3 x daily)\b/i, 3],
  [/\b(twice (a|per) day|two times (a|per) day|2 times (a|per) day|bid|b\.i\.d\.?|bd|2x\/?day|2 x daily|every 12 hours|q12h)\b/i, 2],
  [/\b(once (a|per) day|one time (a|per) day|1 time (a|per) day|once daily|daily|od|o\.d\.?|qd|q\.d\.?|every day|everyday|1x\/?day|every 24 hours|q24h)\b/i, 1],
];

const DURATION_RE = /\b(?:for|x|×|duration)?\s*(\d+)\s*(day|days|d|week|weeks|wk|wks|w|month|months|mo|mos|m)\b/i;
const DOSAGE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|ml|mL|iu|IU|units?|tablets?|tabs?|caps?|capsules?|drops?|puffs?|sachets?|spoons?|tsp|tbsp|%)\b/i;
const COUNT_DOSE_RE = /\b(\d+(?:\.\d+)?|half|one|two|three)\s+(tablets?|tabs?|caps?|capsules?|drops?|puffs?|spoons?|sachets?|pills?)\b/i;
const PREFIX_RE = /^\s*(?:\d+[\).\-:]\s*|[-•*]\s*)?(?:(?:tab\.?|tabs\.?|tablet|cap\.?|caps\.?|capsule|syp\.?|syrup|inj\.?|injection|rx|r\/|sig:?|take|use|apply|give|drink)\s+)?/i;
const INSTRUCTION_RE = /\b(after (?:meals?|food|breakfast|lunch|dinner)|before (?:meals?|food|breakfast|lunch|dinner|bed)|with (?:water|food|milk)|on an? empty stomach|as needed|prn|sos|if required|with meals?|chew|dissolve|do not crush|swallow whole)\b/gi;

const WORD_NUMBERS = { half: 0.5, one: 1, two: 2, three: 3 };

const defaultTimesFor = (perDay) => {
  switch (perDay) {
    case 4:
      return ["Morning", "Afternoon", "Evening", "Night"];
    case 3:
      return ["Morning", "Afternoon", "Night"];
    case 2:
      return ["Morning", "Night"];
    default:
      return ["Morning"];
  }
};

const titleCase = (s) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

/** Parse one prescription line. Returns null when no medicine name can be found. */
const parseLine = (rawLine) => {
  const line = String(rawLine || "").replace(/\s+/g, " ").trim();
  if (!line || line.length < 3) return null;
  // Skip obvious headers
  if (/^(patient|name|date|dr\.?|doctor|diagnosis|age|sex|gender|address|signature|clinic|hospital)\b\s*[:\-]/i.test(line)) return null;

  let confidence = 0.4;
  let working = line.replace(PREFIX_RE, "");

  // Dosage
  let dosage = "";
  const dose = working.match(DOSAGE_RE);
  if (dose) {
    const unit = dose[2].toLowerCase() === "ml" ? "ml" : dose[2];
    const compact = /^(mg|mcg|µg|ug|g|ml|iu|%)$/i.test(unit);
    dosage = compact ? `${dose[1].replace(",", ".")}${unit}` : `${dose[1].replace(",", ".")} ${unit.toLowerCase()}`;
    confidence += 0.25;
  } else {
    const count = working.match(COUNT_DOSE_RE);
    if (count) {
      const n = WORD_NUMBERS[count[1].toLowerCase()] ?? count[1];
      dosage = `${n} ${count[2].toLowerCase()}`;
      confidence += 0.15;
    }
  }

  // Frequency
  let perDay = null;
  let frequency = "daily";
  for (const [re, n] of FREQ_PATTERNS) {
    if (re.test(working)) {
      perDay = n;
      confidence += 0.15;
      break;
    }
  }
  if (/\b(once (a|per) week|weekly|every week|qw|q7d)\b/i.test(working)) {
    frequency = "weekly";
    perDay = perDay || 1;
    confidence += 0.1;
  }
  if (/\b(alternate days?|every other day|qod|every 2 days)\b/i.test(working)) {
    frequency = "custom";
  }

  // Times of day explicitly named
  const times = [];
  for (const [re, name] of TIME_WORDS) {
    if (re.test(working) && !times.includes(name)) times.push(name);
  }
  if (times.length) confidence += 0.1;
  let timeOfDay = times.length ? times : defaultTimesFor(perDay || 1);
  if (perDay && times.length && times.length < perDay) {
    // "twice daily, morning" → fill the remaining slots sensibly
    for (const t of defaultTimesFor(perDay)) {
      if (timeOfDay.length >= perDay) break;
      if (!timeOfDay.includes(t)) timeOfDay.push(t);
    }
  }
  const order = { Morning: 0, Afternoon: 1, Evening: 2, Night: 3 };
  timeOfDay = [...new Set(timeOfDay)].sort((a, b) => order[a] - order[b]);

  // Duration
  let durationDays = null;
  const dur = working.match(DURATION_RE);
  if (dur) {
    const n = parseInt(dur[1], 10);
    const unit = dur[2].toLowerCase();
    durationDays = /^d/.test(unit) ? n : /^w/.test(unit) ? n * 7 : n * 30;
    confidence += 0.05;
  }

  // Instructions
  const instructions = [...new Set((working.match(INSTRUCTION_RE) || []).map((s) => s.toLowerCase()))].join(", ");

  // Medicine name: text before the dosage / frequency / first digit
  let namePart = working;
  const cutAt = [dose?.index, working.search(/\d/), working.search(/\b(once|twice|thrice|daily|bid|bd|tid|tds|od|qd|qid|every|morning|night|evening|afternoon|after|before|with|for|x)\b/i)]
    .filter((i) => typeof i === "number" && i > 0)
    .sort((a, b) => a - b)[0];
  if (cutAt) namePart = working.slice(0, cutAt);
  namePart = namePart.replace(/[-–:,(]+\s*$/g, "").replace(/\b(tablet|tab|capsule|cap|syrup|syp)s?\b\.?/gi, "").trim();
  if (!namePart || !/[a-z]/i.test(namePart)) return null;
  const medicineName = titleCase(namePart.replace(/[^\w\s\-\/+]/g, "").trim());
  if (medicineName.length < 2) return null;
  confidence += 0.05;

  return {
    medicineName,
    dosage: dosage || "as directed",
    frequency,
    timeOfDay,
    durationDays,
    instructions,
    sourceLine: line,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
};

/** Parse a whole prescription text block (one medicine per line / sentence). */
const parsePrescriptionText = (text) => {
  const lines = String(text || "")
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const medications = [];
  const unparsed = [];
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) medications.push(parsed);
    else unparsed.push(line);
  }
  return { medications, unparsed, parsedLines: medications.length, totalLines: lines.length };
};

module.exports = { parseLine, parsePrescriptionText };
