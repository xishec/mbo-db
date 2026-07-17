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
  // Daily temperature values (for aggregation by period)
  dailyHighTemp?: number; // Daily high temp (°C) - for calculating "Mean daily high" and "Highest temp"
  dailyLowTemp?: number; // Daily low temp (°C) - for calculating "Mean daily low" and "Lowest temp"
  dailyMeanTemp?: number; // Daily mean temp (°C) - for calculating "Mean daily temp"

  // Precipitation
  totalRainfallMm?: number; // Total rain (mm) - for period sum and "# days with rainfall" count
  totalSnowCm?: number; // Total snow (cm) - for period sum and "# days with snowfall" count
  daysWithRainfall?: number; // Used in period summaries; optional for daily records
  daysWithSnowfall?: number; // Used in period summaries; optional for daily records

  // Snow depth
  meanSnowDepthCm?: number; // Mean snow depth (cm)
  maxSnowDepthCm?: number; // Max. snow depth (cm)

  // Other
  cloudCoverage?: number; // percentage 0-100
  windSpeed?: number; // km/h
  windDirection?: string; // N, NE, E, SE, S, SW, W, NW
  humidity?: number; // percentage
  description?: string; // Clear, Cloudy, Rain, etc.
}

export interface Net {
  id: string;
  open?: string;
  closed?: string;
  open2?: string;
  closed2?: string;
  open3?: string;
  closed3?: string;
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

// Type for flattened species list items
export type SpeciesPriority = "A" | "B" | "C" | "D";

export type SpeciesListItem =
  { type: "group"; groupName: string } | { type: "species"; code: string; priority?: SpeciesPriority };

// Species groups with species in exact order from the classification table
// Already flattened with group dividers - ready to use directly
export const SPECIES_GROUPS: SpeciesListItem[] = [
  { type: "group", groupName: "WATERFOWL" },
  { type: "species", code: "SNGO" }, // Snow Goose
  { type: "species", code: "CACG" }, // Cackling Goose
  { type: "species", code: "CANG" }, // Canada Goose
  { type: "species", code: "WODU" }, // Wood Duck
  { type: "species", code: "BWTE" }, // Blue-winged Teal
  { type: "species", code: "NSHO" }, // Northern Shoveler
  { type: "species", code: "GADW" }, // Gadwall
  { type: "species", code: "AMWI" }, // American Wigeon
  { type: "species", code: "MALL" }, // Mallard
  { type: "species", code: "ABDU" }, // American Black Duck
  { type: "species", code: "NOPI" }, // Northern Pintail
  { type: "species", code: "AGWT" }, // Green-winged Teal
  { type: "species", code: "RNDU" }, // Ring-necked Duck
  { type: "species", code: "GRSC" }, // Greater Scaup
  { type: "species", code: "LESC" }, // Lesser Scaup
  { type: "species", code: "WWSC" }, // White-winged Scoter
  { type: "species", code: "BLSC" }, // Black Scoter
  { type: "species", code: "HOME" }, // Hooded Merganser
  { type: "species", code: "COME" }, // Common Merganser
  { type: "species", code: "RBME" }, // Red-breasted Merganser
  { type: "group", groupName: "PHASIANIDAE" },
  { type: "species", code: "RUGR" }, // Ruffed Grouse
  { type: "species", code: "WITU" }, // Wild Turkey
  { type: "group", groupName: "GREBES" },
  { type: "species", code: "PBGR" }, // Pied-billed Grebe
  { type: "group", groupName: "PIGEONS DOVES" },
  { type: "species", code: "ROPI" }, // Rock Pigeon (Feral Pigeon)
  { type: "species", code: "MODO" }, // Mourning Dove
  { type: "group", groupName: "CUCKOOS" },
  { type: "species", code: "YBCU" }, // Yellow-billed Cuckoo
  { type: "species", code: "BBCU" }, // Black-billed Cuckoo
  { type: "group", groupName: "TINY FEET" },
  { type: "species", code: "CONI" }, // Common Nighthawk
  { type: "species", code: "CHSW" }, // Chimney Swift
  { type: "species", code: "RTHU" }, // Ruby-throated Hummingbird
  { type: "group", groupName: "RAILS" },
  { type: "species", code: "VIRA" }, // Virginia Rail
  { type: "species", code: "SORA" }, // Sora
  { type: "group", groupName: "CRANES" },
  { type: "species", code: "SACR" }, // Sandhill Crane
  { type: "group", groupName: "SHOREBIRDS" },
  { type: "species", code: "KILL" }, // Killdeer
  { type: "species", code: "LESA" }, // Least Sandpiper
  { type: "species", code: "AMWO" }, // American Woodcock
  { type: "species", code: "WISN" }, // Wilson's Snipe
  { type: "species", code: "SPSA" }, // Spotted Sandpiper
  { type: "species", code: "SOSA" }, // Solitary Sandpiper
  { type: "species", code: "GRYE" }, // Greater Yellowlegs
  { type: "species", code: "LEYE" }, // Lesser Yellowlegs
  { type: "group", groupName: "GULLS" },
  { type: "species", code: "RBGU" }, // Ring-billed Gull
  { type: "species", code: "HERG" }, // American Herring Gull
  { type: "species", code: "GBBG" }, // Great Black-backed Gull
  { type: "species", code: "COTE" }, // Common Tern
  { type: "group", groupName: "LOONS" },
  { type: "species", code: "COLO" }, // Common Loon
  { type: "group", groupName: "CORMORANTS" },
  { type: "species", code: "DCCO" }, // Double-crested Cormorant
  { type: "group", groupName: "HERONS" },
  { type: "species", code: "AMBI" }, // American Bittern
  { type: "species", code: "GBHE" }, // Great Blue Heron
  { type: "species", code: "GREG" }, // Great Egret
  { type: "species", code: "GRHE" }, // Green Heron
  { type: "species", code: "BCNH" }, // Black-crowned Night-Heron
  { type: "group", groupName: "VULTURES & HAWKS" },
  { type: "species", code: "TUVU" }, // Turkey Vulture
  { type: "species", code: "OSPR" }, // Osprey
  { type: "species", code: "GOEA" }, // Golden Eagle
  { type: "species", code: "NOHA" }, // Northern Harrier
  { type: "species", code: "SSHA" }, // Sharp-shinned Hawk
  { type: "species", code: "COHA" }, // Cooper's Hawk
  { type: "species", code: "NOGO" }, // American Goshawk
  { type: "species", code: "BAEA" }, // Bald Eagle
  { type: "species", code: "RSHA" }, // Red-shouldered Hawk
  { type: "species", code: "BWHA" }, // Broad-winged Hawk
  { type: "species", code: "RTHA" }, // Red-tailed Hawk
  { type: "species", code: "RLHA" }, // Rough-legged Hawk
  { type: "group", groupName: "OWLS" },
  { type: "species", code: "EASO" }, // Eastern Screech-Owl
  { type: "species", code: "GHOW" }, // Great Horned Owl
  { type: "species", code: "BDOW" }, // Barred Owl
  { type: "species", code: "NSWO" }, // Northern Saw-whet Owl
  { type: "group", groupName: "KINGFISHERS" },
  { type: "species", code: "BEKI", priority: "D" }, // Belted Kingfisher
  { type: "group", groupName: "WOODPECKERS" },
  { type: "species", code: "YBSA", priority: "A" }, // Yellow-bellied Sapsucker
  { type: "species", code: "RBWO" }, // Red-bellied Woodpecker
  { type: "species", code: "DOWO", priority: "D" }, // Downy Woodpecker
  { type: "species", code: "HAWO", priority: "C" }, // Hairy Woodpecker
  { type: "species", code: "PIWO" }, // Pileated Woodpecker
  { type: "species", code: "YSFL", priority: "C" }, // Northern Flicker
  { type: "group", groupName: "FALCONS" },
  { type: "species", code: "AMKE" }, // American Kestrel
  { type: "species", code: "MERL" }, // Merlin
  { type: "species", code: "PEFA" }, // Peregrine Falcon
  { type: "group", groupName: "FLYCATCHERS" },
  { type: "species", code: "OSFL" }, // Olive-sided Flycatcher
  { type: "species", code: "EAWP" }, // Eastern Wood-Pewee
  { type: "species", code: "YBFL", priority: "A" }, // Yellow-bellied Flycatcher
  { type: "species", code: "ALFL", priority: "A" }, // Alder Flycatcher
  { type: "species", code: "TRFL" }, // Traill's Flycatcher
  { type: "species", code: "WIFL" }, // Willow Flycatcher
  { type: "species", code: "LEFL", priority: "C" }, // Least Flycatcher
  { type: "species", code: "EAPH", priority: "D" }, // Eastern Phoebe
  { type: "species", code: "GCFL" }, // Great Crested Flycatcher
  { type: "species", code: "EAKI", priority: "C" }, // Eastern Kingbird
  { type: "group", groupName: "VIREOS" },
  { type: "species", code: "BHVI", priority: "C" }, // Blue-headed Vireo
  { type: "species", code: "PHVI", priority: "C" }, // Philadelphia Vireo
  { type: "species", code: "WAVI", priority: "C" }, // Warbling Vireo
  { type: "species", code: "REVI", priority: "C" }, // Red-eyed Vireo
  { type: "group", groupName: "SHRIKE" },
  { type: "species", code: "NSHR" }, // Northern Shrike
  { type: "group", groupName: "CORVIDS" },
  { type: "species", code: "BLJA" }, // Blue Jay
  { type: "species", code: "AMCR", priority: "D" }, // American Crow
  { type: "species", code: "CORA" }, // Common Raven
  { type: "group", groupName: "MÉSANGES" },
  { type: "species", code: "BCCH", priority: "D" }, // Black-capped Chickadee
  { type: "species", code: "TUTI" }, // Tufted Titmouse
  { type: "group", groupName: "LARKS" },
  { type: "species", code: "HOLA" }, // Horned Lark
  { type: "group", groupName: "SWALLOWS" },
  { type: "species", code: "NRWS" }, // Northern Rough-winged Swallow
  { type: "species", code: "PUMA" }, // Purple Martin
  { type: "species", code: "TRES", priority: "C" }, // Tree Swallow
  { type: "species", code: "BANS" }, // Bank Swallow
  { type: "species", code: "BARS", priority: "C" }, // Barn Swallow
  { type: "species", code: "CLSW", priority: "C" }, // Cliff Swallow
  { type: "group", groupName: "KINGLETS" },
  { type: "species", code: "RCKI", priority: "B" }, // Ruby-crowned Kinglet
  { type: "species", code: "GCKI", priority: "C" }, // Golden-crowned Kinglet
  { type: "group", groupName: "NUTHATCHES" },
  { type: "species", code: "RBNU", priority: "D" }, // Red-breasted Nuthatch
  { type: "species", code: "WBNU" }, // White-breasted Nuthatch
  { type: "group", groupName: "TREE CREEPERS" },
  { type: "species", code: "BRCR", priority: "D" }, // Brown Creeper
  { type: "group", groupName: "GNATCATCHERS" },
  { type: "species", code: "BGGN" }, // Blue-gray Gnatcatcher
  { type: "group", groupName: "WRENS" },
  { type: "species", code: "HOWR" }, // Northern House Wren
  { type: "species", code: "WIWR", priority: "D" }, // Winter Wren
  { type: "species", code: "MAWR" }, // Marsh Wren
  { type: "species", code: "CARW" }, // Carolina Wren
  { type: "group", groupName: "STARLINGS" },
  { type: "species", code: "EUST", priority: "D" }, // European Starling
  { type: "group", groupName: "MIMIDS" },
  { type: "species", code: "GRCA" }, // Gray Catbird
  { type: "species", code: "BRTH" }, // Brown Thrasher
  { type: "species", code: "NOMO" }, // Northern Mockingbird
  { type: "group", groupName: "THRUSHES" },
  { type: "species", code: "EABL" }, // Eastern Bluebird
  { type: "species", code: "VEER" }, // Veery
  { type: "species", code: "GCTH", priority: "A" }, // Gray-cheeked Thrush
  { type: "species", code: "BITH" }, // Bicknell's Thrush
  { type: "species", code: "SWTH", priority: "A" }, // Swainson's Thrush
  { type: "species", code: "HETH", priority: "C" }, // Hermit Thrush
  { type: "species", code: "WOTH" }, // Wood Thrush
  { type: "species", code: "AMRO", priority: "D" }, // American Robin
  { type: "group", groupName: "WAXWINGS" },
  { type: "species", code: "BOWA" }, // Bohemian Waxwing
  { type: "species", code: "CEDW", priority: "D" }, // Cedar Waxwing
  { type: "group", groupName: "INVASIVE" },
  { type: "species", code: "HOSP" }, // House Sparrow
  { type: "group", groupName: "PIPITS" },
  { type: "species", code: "AMPI" }, // American Pipit
  { type: "group", groupName: "FINCHES & WINTER FINCHES" },
  { type: "species", code: "EVGR" }, // Evening Grosbeak
  { type: "species", code: "PIGR" }, // Pine Grosbeak
  { type: "species", code: "HOFI" }, // House Finch
  { type: "species", code: "PUFI", priority: "D" }, // Purple Finch
  { type: "species", code: "CORE" }, // Common Redpoll
  { type: "species", code: "WWCR" }, // White-winged Crossbill
  { type: "species", code: "PISI" }, // Pine Siskin
  { type: "species", code: "AMGO" }, // American Goldfinch
  { type: "group", groupName: "SPARROWS" },
  { type: "species", code: "SNBU" }, // Snow Bunting
  { type: "species", code: "CHSP", priority: "C" }, // Chipping Sparrow
  { type: "species", code: "FISP" }, // Field Sparrow
  { type: "species", code: "ATSP", priority: "B" }, // American Tree Sparrow
  { type: "species", code: "FOSP", priority: "B" }, // Fox Sparrow
  { type: "species", code: "SCJU", priority: "B" }, // Dark-eyed Junco
  { type: "species", code: "EWCS", priority: "B" }, // White-crowned Sparrow
  { type: "species", code: "WTSP", priority: "B" }, // White-throated Sparrow
  { type: "species", code: "VESP" }, // Vesper Sparrow
  { type: "species", code: "SAVS", priority: "A" }, // Savannah Sparrow
  { type: "species", code: "SOSP", priority: "D" }, // Song Sparrow
  { type: "species", code: "LISP", priority: "A" }, // Lincoln's Sparrow
  { type: "species", code: "SWSP", priority: "B" }, // Swamp Sparrow
  { type: "species", code: "EATO" }, // Eastern Towhee
  { type: "group", groupName: "BLACKBIRDS" },
  { type: "species", code: "BOBO" }, // Bobolink
  { type: "species", code: "EAME" }, // Eastern Meadowlark
  { type: "species", code: "BAOR" }, // Baltimore Oriole
  { type: "species", code: "RWBL", priority: "D" }, // Red-winged Blackbird
  { type: "species", code: "BHCO" }, // Brown-headed Cowbird
  { type: "species", code: "RUBL", priority: "B" }, // Rusty Blackbird
  { type: "species", code: "COGR", priority: "D" }, // Common Grackle
  { type: "group", groupName: "WARBLERS" },
  { type: "species", code: "OVEN", priority: "C" }, // Ovenbird
  { type: "species", code: "NOWA", priority: "A" }, // Northern Waterthrush
  { type: "species", code: "BAWW", priority: "C" }, // Black-and-white Warbler
  { type: "species", code: "TEWA", priority: "A" }, // Tennessee Warbler
  { type: "species", code: "OCWA", priority: "A" }, // Orange-crowned Warbler
  { type: "species", code: "NAWA" }, // Nashville Warbler
  { type: "species", code: "CONW" }, // Connecticut Warbler
  { type: "species", code: "MOWA", priority: "C" }, // Mourning Warbler
  { type: "species", code: "COYE", priority: "C" }, // Common Yellowthroat
  { type: "species", code: "AMRE" }, // American Redstart
  { type: "species", code: "CMWA", priority: "A" }, // Cape May Warbler
  { type: "species", code: "NOPA" }, // Northern Parula
  { type: "species", code: "MAWA", priority: "A" }, // Magnolia Warbler
  { type: "species", code: "BBWA", priority: "A" }, // Bay-breasted Warbler
  { type: "species", code: "BLBW" }, // Blackburnian Warbler
  { type: "species", code: "YEWA", priority: "C" }, // Yellow Warbler
  { type: "species", code: "CSWA" }, // Chestnut-sided Warbler
  { type: "species", code: "BLPW", priority: "A" }, // Blackpoll Warbler
  { type: "species", code: "BTBW" }, // Black-throated Blue Warbler
  { type: "species", code: "WPWA" }, // Western Palm Warbler
  { type: "species", code: "YPWA" }, // Yellow Palm Warbler
  { type: "species", code: "PIWA" }, // Pine Warbler
  { type: "species", code: "MYWA", priority: "B" }, // Yellow-rumped Warbler
  { type: "species", code: "BTNW", priority: "C" }, // Black-throated Green Warbler
  { type: "species", code: "CAWA", priority: "C" }, // Canada Warbler
  { type: "species", code: "WIWA", priority: "A" }, // Wilson's Warbler
  { type: "group", groupName: "TANAGERS" },
  { type: "species", code: "SCTA" }, // Scarlet Tanager
  { type: "group", groupName: "CARDINALIDAE" },
  { type: "species", code: "NOCA" }, // Northern Cardinal
  { type: "species", code: "RBGR" }, // Rose-breasted Grosbeak
  { type: "species", code: "INBU" }, // Indigo Bunting
];

// Calculate DET species codes set - useful for checking if a code is a DET species
export const DET_SPECIES_CODES_SET = new Set<string>(
  SPECIES_GROUPS.filter((item): item is { type: "species"; code: string } => item.type === "species").map(
    (item) => item.code
  )
);
