export interface BirdStatusInfo {
  code: string;
  description: string;
}

export const BIRD_STATUS_CODES: Record<string, BirdStatusInfo> = {
  "300": {
    code: "300",
    description: "Healthy",
  },
  "301": {
    code: "301",
    description: "Broken wing",
  },
};

export const DEFAULT_BIRD_STATUS = "300";

export function getBirdStatusDescription(code: string): string {
  return BIRD_STATUS_CODES[code]?.description || code;
}
