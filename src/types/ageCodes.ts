export interface AgeCodeInfo {
  code: string;
  alphaCode: string;
  alphaTranslation: string;
  description: string;
}

export const AGE_CODE_MAP: Record<string, AgeCodeInfo> = {
  "0": {
    code: "0",
    alphaCode: "U",
    alphaTranslation: "Unknown",
    description:
      "A bird that cannot be placed in any classes below. Except in cases where data were not recorded or were lost during the nesting season, only birds banded after the breeding season and before January 1 can be correctly coded U.",
  },
  "1": {
    code: "1",
    alphaCode: "AHY",
    alphaTranslation: "After Hatching Year",
    description:
      "A bird known to have hatched before the calendar year of banding; year of hatch otherwise unknown. Example: banded 2017, hatched before January 1, 2017. Birds that would have been coded U on December 31 graduate to class AHY on January 1.",
  },
  "2": {
    code: "2",
    alphaCode: "HY",
    alphaTranslation: "Hatching Year",
    description:
      "A bird capable of sustained flight and known to have hatched during the calendar year in which it was banded. Example: banded 2017, hatched 2017.",
  },
  "3": {
    code: "3",
    alphaCode: "J",
    alphaTranslation: "Juvenile",
    description:
      "Obsolete old code used for a nestling or recent fledgling, probably mostly translatable to age L but not with certainty. The code still exists in the database for old records.",
  },
  "4": {
    code: "4",
    alphaCode: "L",
    alphaTranslation: "Local",
    description:
      "A nestling or young bird incapable of sustained flight. After a young bird achieves sustained flight it becomes age HY until December 31.",
  },
  "5": {
    code: "5",
    alphaCode: "SY",
    alphaTranslation: "Second Year",
    description:
      "A bird known to have hatched in the calendar year preceding the year of banding and now in its second calendar year of life. Example: banded 2017, hatched 2016.",
  },
  "6": {
    code: "6",
    alphaCode: "ASY",
    alphaTranslation: "After Second Year",
    description:
      "A bird known to have hatched earlier than the calendar year preceding the year of banding; year of hatch otherwise unknown. Example: banded 2017, hatched 2015 or earlier.",
  },
  "7": {
    code: "7",
    alphaCode: "TY",
    alphaTranslation: "Third Year",
    description:
      "A bird known to have hatched in the calendar year two years prior to the year of banding and now in its third calendar year of life. Example: banded 2017, hatched 2015.",
  },
  "8": {
    code: "8",
    alphaCode: "ATY",
    alphaTranslation: "After Third Year",
    description:
      "A bird known to have hatched prior to two years prior to the year of banding and now in at least its fourth calendar year of life. Example: banded 2017, hatched 2014 or earlier.",
  },
};

export function getAgeCodeByAlphaCode(alphaCode: string): string | null {
  const entry = Object.entries(AGE_CODE_MAP).find(([, ageInfo]) => ageInfo.alphaCode === alphaCode);
  return entry?.[0] ?? null;
}
