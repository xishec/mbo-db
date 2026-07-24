import { SPECIES_CURRENT_CODE_OVERRIDES } from "./speciesCodeOverrides";

export interface Species {
  code: string;
  currentCode: string;
  pseudoSpeciesType: string;
  speciesDescriptionMBO: string;
  speciesDescriptionCMMN: string;
  speciesFrench: string;
  speciesScientific: string;
}

export type SpeciesMap = Record<string, Species>;

// These objects keep stable references because they are imported throughout
// the app. DataService populates them from Firebase before rendering app data.
export const SPECIES_MAP: SpeciesMap = {};
export const SPECIES_CURRENT_CODE_BY_KEY: Record<string, string> = {};
export const SPECIES_KEY_BY_CURRENT_CODE: Record<string, string> = {};

function replaceRecord<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

export function setSpeciesMap(speciesMap: SpeciesMap = {}): void {
  const normalizedMap: SpeciesMap = {};

  for (const [rawKey, species] of Object.entries(speciesMap)) {
    const key = rawKey.trim().toUpperCase();
    if (!key || !species) continue;

    normalizedMap[key] = {
      ...species,
      code: species.code?.trim().toUpperCase() || key,
      currentCode: species.currentCode?.trim().toUpperCase() || key,
    };
  }

  replaceRecord(SPECIES_MAP, normalizedMap);

  const currentCodeByKey: Record<string, string> = {};
  const keyByCurrentCode: Record<string, string> = {};
  for (const [key, species] of Object.entries(normalizedMap)) {
    const currentCode = SPECIES_CURRENT_CODE_OVERRIDES[key] ?? species.currentCode;
    currentCodeByKey[key] = currentCode;
    keyByCurrentCode[currentCode.toUpperCase()] = key;
  }

  replaceRecord(SPECIES_CURRENT_CODE_BY_KEY, currentCodeByKey);
  replaceRecord(SPECIES_KEY_BY_CURRENT_CODE, keyByCurrentCode);
}

export function getSpeciesDisplayCode(speciesKey: string, aliases: Record<string, string> = {}): string {
  const normalizedKey = speciesKey.toUpperCase();
  const directAlias = aliases[normalizedKey];
  if (directAlias) return directAlias;

  const legacyAlias = Object.entries(aliases).find(([, key]) => key === normalizedKey)?.[0];
  return legacyAlias ?? SPECIES_CURRENT_CODE_BY_KEY[normalizedKey] ?? normalizedKey;
}

export function normalizeSpeciesAliasesMap(aliases: Record<string, string> = {}): Record<string, string> {
  const normalized: Record<string, string> = {};

  Object.entries(aliases).forEach(([key, value]) => {
    const normalizedKey = key.toUpperCase();
    const normalizedValue = value.toUpperCase();

    if (SPECIES_MAP[normalizedKey]) {
      normalized[normalizedKey] = normalizedValue;
      return;
    }

    if (SPECIES_MAP[normalizedValue]) {
      normalized[normalizedValue] = normalizedKey;
    }
  });

  return normalized;
}

export function resolveSpeciesKey(speciesCode: string, aliases: Record<string, string> = {}): string {
  const normalizedCode = speciesCode.toUpperCase();
  const currentSpeciesKey = SPECIES_KEY_BY_CURRENT_CODE[normalizedCode];
  if (currentSpeciesKey) return currentSpeciesKey;

  const aliasSpeciesKey = Object.entries(aliases).find(([, alias]) => alias === normalizedCode)?.[0];
  if (aliasSpeciesKey) return aliasSpeciesKey;

  return aliases[normalizedCode] ?? normalizedCode;
}
