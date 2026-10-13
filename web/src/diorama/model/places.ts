/**
 * Geography tables for the bench: which continent a country belongs to, a few hosting hubs per country
 * for the SAMPLE world, and the fixed spots requests come from.
 *
 * The sample world is a simulation. Its hubs are well known hosting cities and the weights only make the
 * shape plausible (dense Europe and North America, a long tail elsewhere); they are not a measurement of
 * the real network, and the UI labels the sample as a simulation. Live data never reads this table for
 * positions, only for continent codes and display names of countries the API did not name.
 */
import type { Region } from './types';

export interface Hub {
  city: string;
  lat: number;
  lon: number;
  /** Relative share of the country's nodes. */
  w: number;
}

export interface CountrySeed {
  cc: string;
  name: string;
  region: Region;
  /** Relative share of all nodes in the sample world. */
  weight: number;
  hubs: readonly Hub[];
}

const h = (city: string, lat: number, lon: number, w: number): Hub => ({ city, lat, lon, w });

/** Countries that carry nodes in the sample world. Weights are relative, not percentages. */
export const SAMPLE_COUNTRIES: readonly CountrySeed[] = [
  {
    cc: 'US',
    name: 'United States',
    region: 'NA',
    weight: 15,
    hubs: [
      h('Ashburn', 39.04, -77.49, 3),
      h('New York', 40.71, -74.0, 2),
      h('Chicago', 41.88, -87.63, 1.5),
      h('Dallas', 32.78, -96.8, 2),
      h('Los Angeles', 34.05, -118.24, 2),
      h('San Jose', 37.34, -121.89, 1.2),
      h('Seattle', 47.6, -122.33, 1),
      h('Miami', 25.76, -80.19, 1),
      h('Atlanta', 33.75, -84.39, 1.2),
      h('Denver', 39.74, -104.99, 0.6),
      h('Kansas City', 39.1, -94.58, 0.6),
    ],
  },
  {
    cc: 'CA',
    name: 'Canada',
    region: 'NA',
    weight: 4.5,
    hubs: [
      h('Beauharnois', 45.3, -73.9, 3),
      h('Toronto', 43.65, -79.38, 1.5),
      h('Vancouver', 49.28, -123.12, 1),
    ],
  },
  { cc: 'MX', name: 'Mexico', region: 'NA', weight: 0.8, hubs: [h('Mexico City', 19.43, -99.13, 1)] },
  {
    cc: 'BR',
    name: 'Brazil',
    region: 'SA',
    weight: 2.2,
    hubs: [h('Sao Paulo', -23.55, -46.63, 3), h('Rio de Janeiro', -22.9, -43.17, 0.8)],
  },
  { cc: 'AR', name: 'Argentina', region: 'SA', weight: 0.6, hubs: [h('Buenos Aires', -34.6, -58.38, 1)] },
  { cc: 'CL', name: 'Chile', region: 'SA', weight: 0.5, hubs: [h('Santiago', -33.45, -70.67, 1)] },
  { cc: 'CO', name: 'Colombia', region: 'SA', weight: 0.4, hubs: [h('Bogota', 4.71, -74.07, 1)] },
  { cc: 'PE', name: 'Peru', region: 'SA', weight: 0.2, hubs: [h('Lima', -12.05, -77.04, 1)] },
  {
    cc: 'DE',
    name: 'Germany',
    region: 'EU',
    weight: 14,
    hubs: [
      h('Frankfurt', 50.11, 8.68, 4),
      h('Nuremberg', 49.45, 11.08, 2),
      h('Falkenstein', 50.48, 12.37, 3),
      h('Berlin', 52.52, 13.4, 1),
      h('Cologne', 50.94, 6.96, 1),
      h('Munich', 48.14, 11.58, 1),
      h('Hamburg', 53.55, 9.99, 0.8),
    ],
  },
  {
    cc: 'FR',
    name: 'France',
    region: 'EU',
    weight: 10,
    hubs: [
      h('Paris', 48.86, 2.35, 3),
      h('Gravelines', 51.0, 2.1, 2),
      h('Roubaix', 50.69, 3.17, 2),
      h('Strasbourg', 48.57, 7.75, 1.5),
      h('Marseille', 43.3, 5.37, 0.8),
      h('Lyon', 45.76, 4.84, 0.8),
    ],
  },
  {
    cc: 'GB',
    name: 'United Kingdom',
    region: 'EU',
    weight: 6,
    hubs: [
      h('London', 51.51, -0.13, 3.5),
      h('Slough', 51.5, -0.59, 1),
      h('Manchester', 53.48, -2.24, 1),
      h('Edinburgh', 55.95, -3.19, 0.4),
    ],
  },
  { cc: 'IE', name: 'Ireland', region: 'EU', weight: 0.8, hubs: [h('Dublin', 53.35, -6.26, 1)] },
  {
    cc: 'NL',
    name: 'Netherlands',
    region: 'EU',
    weight: 5,
    hubs: [h('Amsterdam', 52.37, 4.9, 3), h('Rotterdam', 51.92, 4.48, 0.8)],
  },
  { cc: 'BE', name: 'Belgium', region: 'EU', weight: 0.8, hubs: [h('Brussels', 50.85, 4.35, 1)] },
  { cc: 'LU', name: 'Luxembourg', region: 'EU', weight: 0.3, hubs: [h('Luxembourg', 49.61, 6.13, 1)] },
  { cc: 'CH', name: 'Switzerland', region: 'EU', weight: 1.2, hubs: [h('Zurich', 47.38, 8.54, 1)] },
  { cc: 'AT', name: 'Austria', region: 'EU', weight: 0.6, hubs: [h('Vienna', 48.21, 16.37, 1)] },
  {
    cc: 'IT',
    name: 'Italy',
    region: 'EU',
    weight: 1.6,
    hubs: [h('Milan', 45.46, 9.19, 2), h('Rome', 41.9, 12.5, 0.7)],
  },
  {
    cc: 'ES',
    name: 'Spain',
    region: 'EU',
    weight: 1.4,
    hubs: [h('Madrid', 40.42, -3.7, 1.5), h('Barcelona', 41.39, 2.17, 0.6)],
  },
  { cc: 'PT', name: 'Portugal', region: 'EU', weight: 0.4, hubs: [h('Lisbon', 38.72, -9.14, 1)] },
  {
    cc: 'PL',
    name: 'Poland',
    region: 'EU',
    weight: 3.5,
    hubs: [h('Warsaw', 52.23, 21.01, 2), h('Krakow', 50.06, 19.94, 0.5)],
  },
  { cc: 'CZ', name: 'Czechia', region: 'EU', weight: 0.8, hubs: [h('Prague', 50.08, 14.44, 1)] },
  { cc: 'HU', name: 'Hungary', region: 'EU', weight: 0.5, hubs: [h('Budapest', 47.5, 19.04, 1)] },
  { cc: 'RO', name: 'Romania', region: 'EU', weight: 1, hubs: [h('Bucharest', 44.43, 26.1, 1)] },
  { cc: 'BG', name: 'Bulgaria', region: 'EU', weight: 0.5, hubs: [h('Sofia', 42.7, 23.32, 1)] },
  { cc: 'GR', name: 'Greece', region: 'EU', weight: 0.3, hubs: [h('Athens', 37.98, 23.73, 1)] },
  { cc: 'SE', name: 'Sweden', region: 'EU', weight: 1.2, hubs: [h('Stockholm', 59.33, 18.07, 1)] },
  { cc: 'NO', name: 'Norway', region: 'EU', weight: 0.6, hubs: [h('Oslo', 59.91, 10.75, 1)] },
  { cc: 'FI', name: 'Finland', region: 'EU', weight: 6, hubs: [h('Helsinki', 60.17, 24.94, 1)] },
  { cc: 'DK', name: 'Denmark', region: 'EU', weight: 0.5, hubs: [h('Copenhagen', 55.68, 12.57, 1)] },
  { cc: 'LT', name: 'Lithuania', region: 'EU', weight: 1, hubs: [h('Vilnius', 54.69, 25.28, 1)] },
  { cc: 'LV', name: 'Latvia', region: 'EU', weight: 0.6, hubs: [h('Riga', 56.95, 24.11, 1)] },
  { cc: 'EE', name: 'Estonia', region: 'EU', weight: 0.4, hubs: [h('Tallinn', 59.44, 24.75, 1)] },
  { cc: 'UA', name: 'Ukraine', region: 'EU', weight: 1.2, hubs: [h('Kyiv', 50.45, 30.52, 1)] },
  {
    cc: 'RU',
    name: 'Russia',
    region: 'EU',
    weight: 2.5,
    hubs: [h('Moscow', 55.76, 37.62, 2), h('Saint Petersburg', 59.93, 30.34, 1)],
  },
  { cc: 'TR', name: 'Turkey', region: 'AS', weight: 1, hubs: [h('Istanbul', 41.01, 28.98, 1)] },
  {
    cc: 'JP',
    name: 'Japan',
    region: 'AS',
    weight: 3,
    hubs: [h('Tokyo', 35.68, 139.69, 3), h('Osaka', 34.69, 135.5, 1)],
  },
  { cc: 'KR', name: 'South Korea', region: 'AS', weight: 1.2, hubs: [h('Seoul', 37.57, 126.98, 1)] },
  {
    cc: 'CN',
    name: 'China',
    region: 'AS',
    weight: 1,
    hubs: [h('Beijing', 39.9, 116.4, 1), h('Shanghai', 31.23, 121.47, 1)],
  },
  { cc: 'HK', name: 'Hong Kong', region: 'AS', weight: 1, hubs: [h('Hong Kong', 22.32, 114.17, 1)] },
  { cc: 'TW', name: 'Taiwan', region: 'AS', weight: 0.5, hubs: [h('Taipei', 25.03, 121.57, 1)] },
  { cc: 'SG', name: 'Singapore', region: 'AS', weight: 3, hubs: [h('Singapore', 1.35, 103.82, 1)] },
  {
    cc: 'IN',
    name: 'India',
    region: 'AS',
    weight: 1.5,
    hubs: [h('Mumbai', 19.08, 72.88, 1), h('Bengaluru', 12.97, 77.59, 0.7), h('Delhi', 28.61, 77.21, 0.5)],
  },
  { cc: 'ID', name: 'Indonesia', region: 'AS', weight: 0.8, hubs: [h('Jakarta', -6.2, 106.85, 1)] },
  { cc: 'MY', name: 'Malaysia', region: 'AS', weight: 0.5, hubs: [h('Kuala Lumpur', 3.14, 101.69, 1)] },
  { cc: 'TH', name: 'Thailand', region: 'AS', weight: 0.5, hubs: [h('Bangkok', 13.76, 100.5, 1)] },
  { cc: 'VN', name: 'Vietnam', region: 'AS', weight: 0.5, hubs: [h('Ho Chi Minh City', 10.82, 106.63, 1)] },
  { cc: 'PH', name: 'Philippines', region: 'AS', weight: 0.3, hubs: [h('Manila', 14.6, 120.98, 1)] },
  { cc: 'AE', name: 'United Arab Emirates', region: 'AS', weight: 0.6, hubs: [h('Dubai', 25.2, 55.27, 1)] },
  { cc: 'IL', name: 'Israel', region: 'AS', weight: 0.4, hubs: [h('Tel Aviv', 32.08, 34.78, 1)] },
  { cc: 'KZ', name: 'Kazakhstan', region: 'AS', weight: 0.3, hubs: [h('Almaty', 43.24, 76.89, 1)] },
  {
    cc: 'ZA',
    name: 'South Africa',
    region: 'AF',
    weight: 0.8,
    hubs: [h('Johannesburg', -26.2, 28.05, 2), h('Cape Town', -33.92, 18.42, 1)],
  },
  { cc: 'NG', name: 'Nigeria', region: 'AF', weight: 0.3, hubs: [h('Lagos', 6.52, 3.38, 1)] },
  { cc: 'KE', name: 'Kenya', region: 'AF', weight: 0.2, hubs: [h('Nairobi', -1.29, 36.82, 1)] },
  { cc: 'EG', name: 'Egypt', region: 'AF', weight: 0.2, hubs: [h('Cairo', 30.04, 31.24, 1)] },
  { cc: 'MA', name: 'Morocco', region: 'AF', weight: 0.15, hubs: [h('Casablanca', 33.57, -7.59, 1)] },
  {
    cc: 'AU',
    name: 'Australia',
    region: 'OC',
    weight: 2.5,
    hubs: [
      h('Sydney', -33.87, 151.21, 2),
      h('Melbourne', -37.81, 144.96, 1.2),
      h('Perth', -31.95, 115.86, 0.6),
      h('Brisbane', -27.47, 153.03, 0.6),
    ],
  },
  { cc: 'NZ', name: 'New Zealand', region: 'OC', weight: 0.5, hubs: [h('Auckland', -36.85, 174.76, 1)] },
];

/**
 * Continent code and display name by country, using the convention of IP geolocation services (the same
 * one a Flux `geolocation` entry matches on). Covers every country that plausibly hosts a node.
 */
const COUNTRY_ROWS =
  // Africa
  'DZ:Algeria:AF,AO:Angola:AF,BJ:Benin:AF,BW:Botswana:AF,BF:Burkina Faso:AF,BI:Burundi:AF,CM:Cameroon:AF,' +
  'CV:Cape Verde:AF,CD:DR Congo:AF,CG:Congo:AF,CI:Cote d Ivoire:AF,DJ:Djibouti:AF,EG:Egypt:AF,ET:Ethiopia:AF,' +
  'GA:Gabon:AF,GH:Ghana:AF,GN:Guinea:AF,KE:Kenya:AF,LY:Libya:AF,MG:Madagascar:AF,MW:Malawi:AF,ML:Mali:AF,' +
  'MR:Mauritania:AF,MU:Mauritius:AF,MA:Morocco:AF,MZ:Mozambique:AF,NA:Namibia:AF,NE:Niger:AF,NG:Nigeria:AF,' +
  'RW:Rwanda:AF,SN:Senegal:AF,SC:Seychelles:AF,SO:Somalia:AF,ZA:South Africa:AF,SD:Sudan:AF,TZ:Tanzania:AF,' +
  'TG:Togo:AF,TN:Tunisia:AF,UG:Uganda:AF,ZM:Zambia:AF,ZW:Zimbabwe:AF,RE:Reunion:AF,' +
  // Asia
  'AF:Afghanistan:AS,AM:Armenia:AS,AZ:Azerbaijan:AS,BH:Bahrain:AS,BD:Bangladesh:AS,BT:Bhutan:AS,BN:Brunei:AS,' +
  'KH:Cambodia:AS,CN:China:AS,GE:Georgia:AS,HK:Hong Kong:AS,IN:India:AS,ID:Indonesia:AS,IR:Iran:AS,IQ:Iraq:AS,' +
  'IL:Israel:AS,JP:Japan:AS,JO:Jordan:AS,KZ:Kazakhstan:AS,KW:Kuwait:AS,KG:Kyrgyzstan:AS,LA:Laos:AS,LB:Lebanon:AS,' +
  'MO:Macao:AS,MY:Malaysia:AS,MV:Maldives:AS,MN:Mongolia:AS,MM:Myanmar:AS,NP:Nepal:AS,KP:North Korea:AS,' +
  'OM:Oman:AS,PK:Pakistan:AS,PS:Palestine:AS,PH:Philippines:AS,QA:Qatar:AS,SA:Saudi Arabia:AS,SG:Singapore:AS,' +
  'KR:South Korea:AS,LK:Sri Lanka:AS,SY:Syria:AS,TW:Taiwan:AS,TJ:Tajikistan:AS,TH:Thailand:AS,TL:Timor-Leste:AS,' +
  'TR:Turkey:AS,TM:Turkmenistan:AS,AE:United Arab Emirates:AS,UZ:Uzbekistan:AS,VN:Vietnam:AS,YE:Yemen:AS,' +
  // Europe
  'AL:Albania:EU,AD:Andorra:EU,AT:Austria:EU,BY:Belarus:EU,BE:Belgium:EU,BA:Bosnia and Herzegovina:EU,' +
  'BG:Bulgaria:EU,HR:Croatia:EU,CY:Cyprus:EU,CZ:Czechia:EU,DK:Denmark:EU,EE:Estonia:EU,FO:Faroe Islands:EU,' +
  'FI:Finland:EU,FR:France:EU,DE:Germany:EU,GI:Gibraltar:EU,GR:Greece:EU,HU:Hungary:EU,IS:Iceland:EU,' +
  'IE:Ireland:EU,IT:Italy:EU,XK:Kosovo:EU,LV:Latvia:EU,LI:Liechtenstein:EU,LT:Lithuania:EU,LU:Luxembourg:EU,' +
  'MT:Malta:EU,MD:Moldova:EU,MC:Monaco:EU,ME:Montenegro:EU,NL:Netherlands:EU,MK:North Macedonia:EU,' +
  'NO:Norway:EU,PL:Poland:EU,PT:Portugal:EU,RO:Romania:EU,RU:Russia:EU,RS:Serbia:EU,SK:Slovakia:EU,' +
  'SI:Slovenia:EU,ES:Spain:EU,SE:Sweden:EU,CH:Switzerland:EU,UA:Ukraine:EU,GB:United Kingdom:EU,IM:Isle of Man:EU,' +
  'JE:Jersey:EU,GG:Guernsey:EU,' +
  // North America
  'US:United States:NA,CA:Canada:NA,MX:Mexico:NA,GT:Guatemala:NA,BZ:Belize:NA,SV:El Salvador:NA,HN:Honduras:NA,' +
  'NI:Nicaragua:NA,CR:Costa Rica:NA,PA:Panama:NA,CU:Cuba:NA,JM:Jamaica:NA,HT:Haiti:NA,DO:Dominican Republic:NA,' +
  'PR:Puerto Rico:NA,BS:Bahamas:NA,BB:Barbados:NA,TT:Trinidad and Tobago:NA,GL:Greenland:NA,BM:Bermuda:NA,' +
  'KY:Cayman Islands:NA,' +
  // South America
  'AR:Argentina:SA,BO:Bolivia:SA,BR:Brazil:SA,CL:Chile:SA,CO:Colombia:SA,EC:Ecuador:SA,GY:Guyana:SA,' +
  'PY:Paraguay:SA,PE:Peru:SA,SR:Suriname:SA,UY:Uruguay:SA,VE:Venezuela:SA,GF:French Guiana:SA,' +
  // Oceania
  'AU:Australia:OC,NZ:New Zealand:OC,FJ:Fiji:OC,PG:Papua New Guinea:OC,NC:New Caledonia:OC,' +
  'PF:French Polynesia:OC,GU:Guam:OC,WS:Samoa:OC,TO:Tonga:OC,VU:Vanuatu:OC';

export const COUNTRY_NAME: Readonly<Record<string, string>> = {};
export const REGION_OF_CC: Readonly<Record<string, Region>> = {};
for (const row of COUNTRY_ROWS.split(',')) {
  const [cc, name, region] = row.split(':') as [string, string, Region];
  (COUNTRY_NAME as Record<string, string>)[cc] = name;
  (REGION_OF_CC as Record<string, Region>)[cc] = region;
}

/** A display name for a country code: the table, else the code itself. */
export function countryName(cc: string): string {
  return COUNTRY_NAME[cc.toUpperCase()] ?? cc;
}

/** The fixed spots a request can come from. The first few are the default rotation of `send()`. */
export interface UserSeed {
  id: string;
  label: string;
  lat: number;
  lon: number;
  region: Region;
}

export const USER_SEEDS: readonly UserSeed[] = [
  { id: 'london', label: 'London', lat: 51.51, lon: -0.13, region: 'EU' },
  { id: 'new-york', label: 'New York', lat: 40.71, lon: -74.0, region: 'NA' },
  { id: 'tokyo', label: 'Tokyo', lat: 35.68, lon: 139.69, region: 'AS' },
  { id: 'sao-paulo', label: 'Sao Paulo', lat: -23.55, lon: -46.63, region: 'SA' },
  { id: 'mumbai', label: 'Mumbai', lat: 19.08, lon: 72.88, region: 'AS' },
  { id: 'sydney', label: 'Sydney', lat: -33.87, lon: 151.21, region: 'OC' },
  { id: 'lagos', label: 'Lagos', lat: 6.52, lon: 3.38, region: 'AF' },
  { id: 'los-angeles', label: 'Los Angeles', lat: 34.05, lon: -118.24, region: 'NA' },
  { id: 'singapore', label: 'Singapore', lat: 1.35, lon: 103.82, region: 'AS' },
  { id: 'berlin', label: 'Berlin', lat: 52.52, lon: 13.4, region: 'EU' },
];
