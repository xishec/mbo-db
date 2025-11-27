import type { Capture } from './Capture';

export interface Band {
  id: string; // BandPrefix-BandSuffix
  captures: Capture[];
}
