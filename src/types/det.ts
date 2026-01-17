export interface DET {
  date: string;
  banderInCharge: string;
  start: string;
  end: string;

  census: Census;
  nets: Nets;
  observers: Observers;

  narrative: string;
  deviations: string;
  visitors: string[];
  stationManagement: string;
  injuries: Injury[];
  released: Released[];

  // weather
  // Other Flora and Fauna: (Select from Dropdown list)
}

export interface Census {
  censuser: string;
  start: string;
  end: string;
}

export interface Net {
  name: string;
  open: string;
  closed: string;
  hours: string;
  multiplier: number;
  total: string;
}

export interface Nets {
  entries: Net[];
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

export interface Observers {
  entries: Observer[];
  totalObserverHours: number;
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
