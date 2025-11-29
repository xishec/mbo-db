export const NUMERIC_FIELDS = new Set(["WingChord", "Weight", "Fat"]);

export const headerToCaptureProperty: Record<string, string> = {
  Program: "program",

  BandPrefix: "bandPrefix",
  BandSuffix: "bandSuffix",

  Species: "species",
  WingChord: "wing",
  Age: "age",
  HowAged: "howAged",
  Sex: "sex",
  HowSexed: "howSexed",
  Fat: "fat",
  Weight: "weight",
  CaptureDate: "date",
  Bander: "bander",
  Scribe: "scribe",
  Net: "net",
  NotesForMBO: "notes",
  D18: "status",

  // to implement later
  //   Disposition: "disposition",
  //   Location: "location",
  //   BirdStatus: "birdStatus",
  //   PresentCondition: "presentCondition",
  //   HowObtainedCode: "howObtainedCode",
  //   D20: "d20",
  //   D22: "d22",
};
