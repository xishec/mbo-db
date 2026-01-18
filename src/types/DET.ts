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

export enum DETSpecies {
  SNGO = "SNGO", // Snow Goose
  CACG = "CACG", // Cackling Goose
  CANG = "CANG", // Canada Goose
  WODU = "WODU", // Wood Duck
  BWTE = "BWTE", // Blue-winged Teal
  NSHO = "NSHO", // Northern Shoveler
  GADW = "GADW", // Gadwall
  AMWI = "AMWI", // American Wigeon
  MALL = "MALL", // Mallard
  ABDU = "ABDU", // American Black Duck
  NOPI = "NOPI", // Northern Pintail
  AGWT = "AGWT", // Green-winged Teal
  RNDU = "RNDU", // Ring-necked Duck
  GRSC = "GRSC", // Greater Scaup
  LESC = "LESC", // Lesser Scaup
  WWSC = "WWSC", // White-winged Scoter
  BLSC = "BLSC", // Black Scoter
  HOME = "HOME", // Hooded Merganser
  COME = "COME", // Common Merganser
  RBME = "RBME", // Red-breasted Merganser
  RUGR = "RUGR", // Ruffed Grouse
  WITU = "WITU", // Wild Turkey
  PBGR = "PBGR", // Pied-billed Grebe
  ROPI = "ROPI", // Rock Pigeon (Feral Pigeon)
  MODO = "MODO", // Mourning Dove
  YBCU = "YBCU", // Yellow-billed Cuckoo
  BBCU = "BBCU", // Black-billed Cuckoo
  CONI = "CONI", // Common Nighthawk
  CHSW = "CHSW", // Chimney Swift
  RTHU = "RTHU", // Ruby-throated Hummingbird
  VIRA = "VIRA", // Virginia Rail
  SORA = "SORA", // Sora
  SACR = "SACR", // Sandhill Crane
  KILL = "KILL", // Killdeer
  LESA = "LESA", // Least Sandpiper
  AMWO = "AMWO", // American Woodcock
  WISN = "WISN", // Wilson's Snipe
  SPSA = "SPSA", // Spotted Sandpiper
  SOSA = "SOSA", // Solitary Sandpiper
  GRYE = "GRYE", // Greater Yellowlegs
  LEYE = "LEYE", // Lesser Yellowlegs
  RBGU = "RBGU", // Ring-billed Gull
  HERG = "HERG", // American Herring Gull
  GBBG = "GBBG", // Great Black-backed Gull
  COTE = "COTE", // Common Tern
  COLO = "COLO", // Common Loon
  DCCO = "DCCO", // Double-crested Cormorant
  AMBI = "AMBI", // American Bittern
  GBHE = "GBHE", // Great Blue Heron
  GREG = "GREG", // Great Egret
  GRHE = "GRHE", // Green Heron
  BCNH = "BCNH", // Black-crowned Night-Heron
  TUVU = "TUVU", // Turkey Vulture
  OSPR = "OSPR", // Osprey
  GOEA = "GOEA", // Golden Eagle
  NOHA = "NOHA", // Northern Harrier
  SSHA = "SSHA", // Sharp-shinned Hawk
  COHA = "COHA", // Cooper's Hawk
  NOGO = "NOGO", // American Goshawk
  BAEA = "BAEA", // Bald Eagle
  RSHA = "RSHA", // Red-shouldered Hawk
  BWHA = "BWHA", // Broad-winged Hawk
  RTHA = "RTHA", // Red-tailed Hawk
  RLHA = "RLHA", // Rough-legged Hawk
  EASO = "EASO", // Eastern Screech-Owl
  GHOW = "GHOW", // Great Horned Owl
  BDOW = "BDOW", // Barred Owl
  NSWO = "NSWO", // Northern Saw-whet Owl
  BEKI = "BEKI", // Belted Kingfisher
  YBSA = "YBSA", // Yellow-bellied Sapsucker
  RBWO = "RBWO", // Red-bellied Woodpecker
  DOWO = "DOWO", // Downy Woodpecker
  HAWO = "HAWO", // Hairy Woodpecker
  PIWO = "PIWO", // Pileated Woodpecker
  YSFL = "YSFL", // Northern Flicker (Yellow-shafted Flicker)
  AMKE = "AMKE", // American Kestrel
  MERL = "MERL", // Merlin
  PEFA = "PEFA", // Peregrine Falcon
  OSFL = "OSFL", // Olive-sided Flycatcher
  EAWP = "EAWP", // Eastern Wood-pewee
  YBFL = "YBFL", // Yellow-bellied Flycatcher
  ALFL = "ALFL", // Alder Flycatcher
  TRFL = "TRFL", // Traill's Flycatcher
  WIFL = "WIFL", // Willow Flycatcher
  LEFL = "LEFL", // Least Flycatcher
  EAPH = "EAPH", // Eastern Phoebe
  GCFL = "GCFL", // Great Crested Flycatcher
  EAKI = "EAKI", // Eastern Kingbird
  BHVI = "BHVI", // Blue-headed Vireo
  PHVI = "PHVI", // Philadelphia Vireo
  WAVI = "WAVI", // Warbling Vireo
  REVI = "REVI", // Red-eyed Vireo
  NSHR = "NSHR", // Northern Shrike
  BLJA = "BLJA", // Blue Jay
  AMCR = "AMCR", // American Crow
  CORA = "CORA", // Common Raven
  BCCH = "BCCH", // Black-capped Chickadee
  TUTI = "TUTI", // Tufted Titmouse
  HOLA = "HOLA", // Horned Lark
  NRWS = "NRWS", // N. Rough-winged Swallow
  PUMA = "PUMA", // Purple Martin
  TRES = "TRES", // Tree Swallow
  BANS = "BANS", // Bank Swallow
  BARS = "BARS", // Barn Swallow
  CLSW = "CLSW", // Cliff Swallow
  RCKI = "RCKI", // Ruby-crowned Kinglet
  GCKI = "GCKI", // Golden-crowned Kinglet
  RBNU = "RBNU", // Red-breasted Nuthatch
  WBNU = "WBNU", // White-breasted Nuthatch
  BRCR = "BRCR", // Brown Creeper
  BGGN = "BGGN", // Blue-gray Gnatcatcher
  HOWR = "HOWR", // Northern House Wren
  WIWR = "WIWR", // Winter Wren
  MAWR = "MAWR", // Marsh Wren
  CARW = "CARW", // Carolina Wren
  EUST = "EUST", // European Starling
  GRCA = "GRCA", // Gray Catbird
  BRTH = "BRTH", // Brown Thrasher
  NOMO = "NOMO", // Northern Mockingbird
  EABL = "EABL", // Eastern Bluebird
  VEER = "VEER", // Veery
  GCTH = "GCTH", // Gray-cheeked Thrush
  BITH = "BITH", // Bicknell's Thrush
  SWTH = "SWTH", // Swainson's Thrush
  HETH = "HETH", // Hermit Thrush
  WOTH = "WOTH", // Wood Thrush
  AMRO = "AMRO", // American Robin
  BOWA = "BOWA", // Bohemian Waxwing
  CEDW = "CEDW", // Cedar Waxwing
  HOSP = "HOSP", // House Sparrow
  AMPI = "AMPI", // American Pipit
  EVGR = "EVGR", // Evening Grosbeak
  PIGR = "PIGR", // Pine Grosbeak
  HOFI = "HOFI", // House Finch
  PUFI = "PUFI", // Purple Finch
  CORE = "CORE", // Common Redpoll
  WWCR = "WWCR", // White-winged Crossbill
  PISI = "PISI", // Pine Siskin
  AMGO = "AMGO", // American Goldfinch
  SNBU = "SNBU", // Snow Bunting
  CHSP = "CHSP", // Chipping Sparrow
  FISP = "FISP", // Field Sparrow
  ATSP = "ATSP", // American Tree Sparrow
  FOSP = "FOSP", // Fox Sparrow
  SCJU = "SCJU", // Dark-eyed Junco
  EWCS = "EWCS", // White-crowned Sparrow
  WTSP = "WTSP", // White-throated Sparrow
  VESP = "VESP", // Vesper Sparrow
  SAVS = "SAVS", // Savannah Sparrow
  SOSP = "SOSP", // Song Sparrow
  LISP = "LISP", // Lincoln's Sparrow
  SWSP = "SWSP", // Swamp Sparrow
  EATO = "EATO", // Eastern Towhee
  BOBO = "BOBO", // Bobolink
  EAME = "EAME", // Eastern Meadowlark
  BAOR = "BAOR", // Baltimore Oriole
  RWBL = "RWBL", // Red-winged Blackbird
  BHCO = "BHCO", // Brown-headed Cowbird
  RUBL = "RUBL", // Rusty Blackbird
  COGR = "COGR", // Common Grackle
  OVEN = "OVEN", // Ovenbird
  NOWA = "NOWA", // Northern Waterthrush
  BAWW = "BAWW", // Black-and-white Warbler
  TEWA = "TEWA", // Tennessee Warbler
  OCWA = "OCWA", // Orange-crowned Warbler
  NAWA = "NAWA", // Nashville Warbler
  CONW = "CONW", // Connecticut Warbler
  MOWA = "MOWA", // Mourning Warbler
  COYE = "COYE", // Common Yellowthroat
  AMRE = "AMRE", // American Redstart
  CMWA = "CMWA", // Cape May Warbler
  NOPA = "NOPA", // Northern Parula
  MAWA = "MAWA", // Magnolia Warbler
  BBWA = "BBWA", // Bay-breasted Warbler
  BLBW = "BLBW", // Blackburnian Warbler
  YEWA = "YEWA", // Yellow Warbler
  CSWA = "CSWA", // Chestnut-sided Warbler
  BLPW = "BLPW", // Blackpoll Warbler
  BTBW = "BTBW", // Black-throated Blue Warbler
  WPWA = "WPWA", // Western Palm Warbler
  YPWA = "YPWA", // Yellow Palm Warbler
  PIWA = "PIWA", // Pine Warbler
  MYWA = "MYWA", // Yellow-rumped Warbler
  BTNW = "BTNW", // Black-throated Green Warbler
  CAWA = "CAWA", // Canada Warbler
  WIWA = "WIWA", // Wilson's Warbler
  SCTA = "SCTA", // Scarlet Tanager
  NOCA = "NOCA", // Northern Cardinal
  RBGR = "RBGR", // Rose-breasted Grosbeak
  INBU = "INBU", // Indigo Bunting
}
