export interface Year {
  id: string;
  programsIds: string[];
}

export class Program {
  id: string;
  name: string;
  bandGroupIds: string[];
  recaptureIds: string[];

  constructor(name: string) {
    this.id = this.generateId(name);
    this.name = name;
    this.bandGroupIds = [];
    this.recaptureIds = [];
  }

  generateId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-");
  }
}

export class BandGroup {
  id: string;
  captureIds: string[];

  constructor(bandPrefix: string, bandSuffix: string) {
    this.id = `${bandPrefix}-${bandSuffix}`;
    this.captureIds = [];
  }
}

export class Capture {
  id: string;

  programId: string;

  bandPrefix: string;
  bandSuffix: string;
  species: string;
  wing: number;
  age: string;
  howAged: string;
  sex: string;
  howSexed: string;
  fat: number;
  weight: number;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  notes: string;

  // to implement later
  disposition?: string;
  location?: string;
  birdStatus?: string;
  presentCondition?: string;
  howObtainedCode?: string;
  d18?: string;
  d20?: string;
  d22?: string;

  constructor(
    programId: string,
    bandPrefix: string,
    bandSuffix: string,
    lastTwoDigitsOverwrite: string,
    species: string,
    wing: number,
    age: string,
    howAged: string,
    sex: string,
    howSexed: string,
    fat: number,
    weight: number,
    date: string,
    time: string,
    bander: string,
    scribe: string,
    net: string,
    notes: string
  ) {
    const modifiedBandSuffix = bandSuffix.slice(0, -2) + lastTwoDigitsOverwrite;
    this.id = this.generateId(bandPrefix, modifiedBandSuffix, date);
    this.programId = programId;
    this.bandPrefix = bandPrefix;
    this.bandSuffix = modifiedBandSuffix;
    this.species = species;
    this.wing = wing;
    this.age = age;
    this.howAged = howAged;
    this.sex = sex;
    this.howSexed = howSexed;
    this.fat = fat;
    this.weight = weight;
    this.date = date;
    this.time = time;
    this.bander = bander;
    this.scribe = scribe;
    this.net = net;
    this.notes = notes;
  }

  generateId(bandPrefix: string, bandSuffix: string, date: string): string {
    return `${bandPrefix}-${bandSuffix}-${date}`;
  }
}
