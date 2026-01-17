export interface DET {
  date: string;
  programId: string;
  location: string;
  banderInCharge?: string;
  start?: string;
  end?: string;

  observerHours: ObserverHours;
  netHours: NetHours;
  coverageCode: number;

  
  narrative: string;
  deviations: string;
  visitors: string[];
  stationManagement: string;
  injuries: Injury[];
  released: Released[];
  
  // Obs
  observedSpeciesCount: Record<string, number>;
  // Cns
  census: Census;
  // Bnd
  bandedSpeciesCount: Record<string, number>;
  // Rep
  repeatSpeciesCount: Record<string, number>;
  //Ret
  returnSpeciesCount: Record<string, number>;
  // DET
  DETSpeciesCount: Record<string, number>;

  // weather
  // Other Flora and Fauna: (Select from Dropdown list)
}

export interface Census {
  censuser?: string;
  start?: string;
  end?: string;
  // Cns
  speciesCount: Record<string, number>;
}

export interface Net {
  name: string;
  open: string;
  closed: string;
  hours: string;
  multiplier: number;
  total: string;
}

export interface NetHours {
  nets: Net[];
  hummingbirdTrapTotal: string;
  total: string;
}

export interface Observer {
  name: string;
  initials: string;
  hoursObserved: number;
  class: number;
  totalHours: number;
}

export interface ObserverHours {
  observers?: Observer[];
  total: number;
}

export interface Injury {
  specie: string;
  bandId?: string;
  net?: string;
  description: string;
}

export interface Released {
  specie: string;
  age?: string;
  howAged?: string;
  sex?: string;
  howSexed?: string;
  net?: string;
  description?: string;
}
