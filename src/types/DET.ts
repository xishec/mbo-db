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

  censuser?: string;
  censusStart?: string;
  censusEnd?: string;

  // Obs
  observedSpeciesCount: Record<string, number>;
  // Cns
  censusSpeciesCount: Record<string, number>;
  // Bnd
  bandedSpeciesCount: Record<string, number>;
  // Rep
  repeatSpeciesCount: Record<string, number>;
  //Ret
  returnSpeciesCount: Record<string, number>;
  // DET
  DETSpeciesCount: Record<string, number>;

  // weather
  weather?: Weather;
  // Other Flora and Fauna: (Select from Dropdown list)
}

export interface Weather {
  temperature?: number; // Celsius
  temperatureMin?: number;
  temperatureMax?: number;
  cloudCoverage?: number; // percentage 0-100
  precipitation?: number; // mm
  windSpeed?: number; // km/h
  windDirection?: string; // N, NE, E, SE, S, SW, W, NW
  humidity?: number; // percentage
  description?: string; // Clear, Cloudy, Rain, etc.
}

export interface Net {
  id: string;
  open?: string;
  closed?: string;
  hours?: string;
  multiplier?: number;
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

// Species groups with species codes in exact order from the classification table
export const SPECIES_GROUPS = {
  WATERFOWL: [
    "SNGO", // Snow Goose
    "CACG", // Cackling Goose
    "CANG", // Canada Goose
    "WODU", // Wood Duck
    "BWTE", // Blue-winged Teal
    "NSHO", // Northern Shoveler
    "GADW", // Gadwall
    "AMWI", // American Wigeon
    "MALL", // Mallard
    "ABDU", // American Black Duck
    "NOPI", // Northern Pintail
    "AGWT", // Green-winged Teal
    "RNDU", // Ring-necked Duck
    "GRSC", // Greater Scaup
    "LESC", // Lesser Scaup
    "WWSC", // White-winged Scoter
    "BLSC", // Black Scoter
    "HOME", // Hooded Merganser
    "COME", // Common Merganser
    "RBME", // Red-breasted Merganser
  ],
  PHASIANIDAE: [
    "RUGR", // Ruffed Grouse
    "WITU", // Wild Turkey
  ],
  GREBES: [
    "PBGR", // Pied-billed Grebe
  ],
  "PIGEONS DOVES": [
    "ROPI", // Rock Pigeon (Feral Pigeon)
    "MODO", // Mourning Dove
  ],
  CUCKOOS: [
    "YBCU", // Yellow-billed Cuckoo
    "BBCU", // Black-billed Cuckoo
  ],
  "TINY FEET": [
    "CONI", // Common Nighthawk
    "CHSW", // Chimney Swift
    "RTHU", // Ruby-throated Hummingbird
  ],
  RAILS: [
    "VIRA", // Virginia Rail
    "SORA", // Sora
  ],
  CRANES: [
    "SACR", // Sandhill Crane
  ],
  SHOREBIRDS: [
    "KILL", // Killdeer
    "LESA", // Least Sandpiper
    "AMWO", // American Woodcock
    "WISN", // Wilson's Snipe
    "SPSA", // Spotted Sandpiper
    "SOSA", // Solitary Sandpiper
    "GRYE", // Greater Yellowlegs
    "LEYE", // Lesser Yellowlegs
  ],
  GULLS: [
    "RBGU", // Ring-billed Gull
    "HERG", // American Herring Gull
    "GBBG", // Great Black-backed Gull
    "COTE", // Common Tern
  ],
  LOONS: [
    "COLO", // Common Loon
  ],
  CORMORANTS: [
    "DCCO", // Double-crested Cormorant
  ],
  HERONS: [
    "AMBI", // American Bittern
    "GBHE", // Great Blue Heron
    "GREG", // Great Egret
    "GRHE", // Green Heron
    "BCNH", // Black-crowned Night-Heron
  ],
  "VULTURES & HAWKS": [
    "TUVU", // Turkey Vulture
    "OSPR", // Osprey
    "GOEA", // Golden Eagle
    "NOHA", // Northern Harrier
    "SSHA", // Sharp-shinned Hawk
    "COHA", // Cooper's Hawk
    "NOGO", // American Goshawk
    "BAEA", // Bald Eagle
    "RSHA", // Red-shouldered Hawk
    "BWHA", // Broad-winged Hawk
    "RTHA", // Red-tailed Hawk
    "RLHA", // Rough-legged Hawk
  ],
  OWLS: [
    "EASO", // Eastern Screech-Owl
    "GHOW", // Great Horned Owl
    "BDOW", // Barred Owl
    "NSWO", // Northern Saw-whet Owl
  ],
  KINGFISHERS: [
    "BEKI", // Belted Kingfisher
  ],
  WOODPECKERS: [
    "YBSA", // Yellow-bellied Sapsucker
    "RBWO", // Red-bellied Woodpecker
    "DOWO", // Downy Woodpecker
    "HAWO", // Hairy Woodpecker
    "PIWO", // Pileated Woodpecker
    "YSFL", // Northern Flicker
  ],
  FALCONS: [
    "AMKE", // American Kestrel
    "MERL", // Merlin
    "PEFA", // Peregrine Falcon
  ],
  FLYCATCHERS: [
    "OSFL", // Olive-sided Flycatcher
    "EAWP", // Eastern Wood-Pewee
    "YBFL", // Yellow-bellied Flycatcher
    "ALFL", // Alder Flycatcher
    "WIFL", // Willow Flycatcher
    "LEFL", // Least Flycatcher
    "EAPH", // Eastern Phoebe
    "GCFL", // Great Crested Flycatcher
    "EAKI", // Eastern Kingbird
  ],
  VIREOS: [
    "BHVI", // Blue-headed Vireo
    "PHVI", // Philadelphia Vireo
    "WAVI", // Warbling Vireo
    "REVI", // Red-eyed Vireo
  ],
  SHRIKE: [
    "NSHR", // Northern Shrike
  ],
  CORVIDS: [
    "BLJA", // Blue Jay
    "AMCR", // American Crow
    "CORA", // Common Raven
  ],
  MESANGES: [
    "BCCH", // Black-capped Chickadee
    "TUTI", // Tufted Titmouse
  ],
  LARKS: [
    "HOLA", // Horned Lark
  ],
  SWALLOWS: [
    "NRWS", // Northern Rough-winged Swallow
    "PUMA", // Purple Martin
    "TRES", // Tree Swallow
    "BANS", // Bank Swallow
    "BARS", // Barn Swallow
    "CLSW", // Cliff Swallow
  ],
  KINGLETS: [
    "RCKI", // Ruby-crowned Kinglet
    "GCKI", // Golden-crowned Kinglet
  ],
  NUTHATCHES: [
    "RBNU", // Red-breasted Nuthatch
    "WBNU", // White-breasted Nuthatch
  ],
  "TREE CREEPERS": [
    "BRCR", // Brown Creeper
  ],
  GNATCATCHERS: [
    "BGGN", // Blue-gray Gnatcatcher
  ],
  WRENS: [
    "HOWR", // Northern House Wren
    "WIWR", // Winter Wren
    "MAWR", // Marsh Wren
    "CARW", // Carolina Wren
  ],
  STARLINGS: [
    "EUST", // European Starling
  ],
  MIMIDS: [
    "GRCA", // Gray Catbird
    "BRTH", // Brown Thrasher
    "NOMO", // Northern Mockingbird
  ],
  THRUSHES: [
    "EABL", // Eastern Bluebird
    "VEER", // Veery
    "GCTH", // Gray-cheeked Thrush
    "BITH", // Bicknell's Thrush
    "SWTH", // Swainson's Thrush
    "HETH", // Hermit Thrush
    "WOTH", // Wood Thrush
    "AMRO", // American Robin
  ],
  WAXWINGS: [
    "BOWA", // Bohemian Waxwing
    "CEDW", // Cedar Waxwing
  ],
  INVASIVE: [
    "HOSP", // House Sparrow
  ],
  PIPITS: [
    "AMPI", // American Pipit
  ],
  "FINCHES & WINTER FINCHES": [
    "EVGR", // Evening Grosbeak
    "PIGR", // Pine Grosbeak
    "HOFI", // House Finch
    "PUFI", // Purple Finch
    "CORE", // Common Redpoll
    "WWCR", // White-winged Crossbill
    "PISI", // Pine Siskin
    "AMGO", // American Goldfinch
  ],
  SPARROWS: [
    "SNBU", // Snow Bunting
    "CHSP", // Chipping Sparrow
    "FISP", // Field Sparrow
    "ATSP", // American Tree Sparrow
    "FOSP", // Fox Sparrow
    "SCJU", // Dark-eyed Junco
    "EWCS", // White-crowned Sparrow
    "WTSP", // White-throated Sparrow
    "VESP", // Vesper Sparrow
    "SAVS", // Savannah Sparrow
    "SOSP", // Song Sparrow
    "LISP", // Lincoln's Sparrow
    "SWSP", // Swamp Sparrow
    "EATO", // Eastern Towhee
  ],
  BLACKBIRDS: [
    "RWBL", // Red-winged Blackbird
    "EAME", // Eastern Meadowlark
    "BAOR", // Baltimore Oriole
    "BHCO", // Brown-headed Cowbird
    "RUBL", // Rusty Blackbird
    "COGR", // Common Grackle
    "OVEN", // Ovenbird
  ],
  WARBLERS: [
    "NOWA", // Northern Waterthrush
    "BAWW", // Black-and-white Warbler
    "TEWA", // Tennessee Warbler
    "OCWA", // Orange-crowned Warbler
    "NAWA", // Nashville Warbler
    "CONW", // Connecticut Warbler
    "MOWA", // Mourning Warbler
    "COYE", // Common Yellowthroat
    "AMRE", // American Redstart
    "CMWA", // Cape May Warbler
    "NOPA", // Northern Parula
    "MAWA", // Magnolia Warbler
    "BBWA", // Bay-breasted Warbler
    "BLBW", // Blackburnian Warbler
    "YEWA", // Yellow Warbler
    "CSWA", // Chestnut-sided Warbler
    "BLPW", // Blackpoll Warbler
    "BTBW", // Black-throated Blue Warbler
    "MYWA", // Yellow-rumped Warbler
    "YPWA", // Yellow Palm Warbler
    "PIWA", // Pine Warbler
    "BTNW", // Black-throated Green Warbler
    "CAWA", // Canada Warbler
    "WIWA", // Wilson's Warbler
  ],
  TANAGERS: [
    "SCTA", // Scarlet Tanager
  ],
  CARDINALIDAE: [
    "NOCA", // Northern Cardinal
    "RBGR", // Rose-breasted Grosbeak
    "INBU", // Indigo Bunting
  ],
} as const;
