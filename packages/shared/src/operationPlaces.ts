import type { Building, WorldGeometry } from './urban-map.js'

type Kind=NonNullable<Building['architecture']>
type Address=[name:string,x:number,z:number,width:number,depth:number,kind:Kind,height?:number]
type Patch=NonNullable<WorldGeometry['surfaces']>[number]
export interface OperationPlace {
  identity:string; limit:number; atmosphere:'day'|'overcast'|'haze'
  // First three addresses are mission sites: west, east and north. Remaining addresses shape the routes.
  addresses:Address[]
  insertion:[number,number]; south:[number,number]; center:[number,number]; exit:[number,number]
  surfaces:Patch[]
  preview:{eye:[number,number,number];target:[number,number,number]}
}
const road=(x:number,z:number,width:number,depth:number):Patch=>({x,z,width,depth,kind:'asphalt'})
const lawn=(x:number,z:number,width:number,depth:number):Patch=>({x,z,width,depth,kind:'grass'})
const court=(x:number,z:number,width:number,depth:number):Patch=>({x,z,width,depth,kind:'paving'})
const apron=(x:number,z:number,width:number,depth:number):Patch=>({x,z,width,depth,kind:'apron'})

/** Authored addresses and bounded streets, not a shared placement grid. */
export const OPERATION_PLACES:Record<string,OperationPlace>={
 'blackout':{identity:'Power station and workers’ terraces',limit:88,atmosphere:'overcast',insertion:[-70,-70],south:[-25,-40],center:[20,10],exit:[72,-65],preview:{eye:[-34,6,-57],target:[-38,3,-14]},surfaces:[road(-22,0,9,155),road(18,-42,88,8),court(27,22,78,87),lawn(-61,56,31,43)],addresses:[
  ['GRID CONTROL',-47,-12,22,18,'workshop'],['TURBINE HOUSE',52,30,38,46,'hall',10],['SWITCHGEAR',12,61,26,16,'workshop'],
  ['CALDER TERRACE',-62,-50,14,20,'terrace',6.4],['WORKERS HOMES',-42,-52,14,20,'terrace',6.4],['CORNER CAFE',-47,16,22,14,'shop'],['MAINTENANCE',14,-18,30,14,'hall',6.4],['SUBSTATION OFFICE',64,-25,18,16,'workshop']]},
 'iron-route':{identity:'Railway station and freight sidings',limit:98,atmosphere:'haze',insertion:[-75,-80],south:[-64,-40],center:[4,4],exit:[80,-77],preview:{eye:[-7,7,-63],target:[-32,4,-15]},surfaces:[road(-73,0,8,180),court(-25,-18,78,35),{x:32,z:12,width:48,depth:170,kind:'rail'},road(-20,66,90,8)],addresses:[
  ['ASH CENTRAL STATION',-30,-23,52,20,'station',6.4],['ENGINE SHED',65,38,24,46,'hall',8],['SIGNAL HOUSE',-40,55,18,16,'workshop'],
  ['STATION CAFE',-55,-61,22,15,'shop'],['RAIL HOTEL',-30,-63,18,16,'apartment',9.6],['POST OFFICE',-61,22,20,18,'shop'],['GOODS DEPOT',-9,64,26,20,'hall',7],['TICKET OFFICE',-8,22,18,14,'shop']]},
 'cold-water':{identity:'Reservoir, pump station and lakeside homes',limit:92,atmosphere:'day',insertion:[-70,-73],south:[-38,-39],center:[7,7],exit:[70,-70],preview:{eye:[26,8,-38],target:[-21,3,18]},surfaces:[road(-43,0,8,158),road(1,-42,95,8),lawn(-68,35,23,83),court(25,14,67,48)],addresses:[
  ['INTAKE HOUSE',-21,26,18,20,'workshop'],['PUMP STATION',55,18,28,34,'hall',7],['WATER AUTHORITY',12,64,34,18,'station',6.4],
  ['LAKESIDE COTTAGE',-67,-23,10,9,'house'],['FAMILY HOME',-64,4,13,11,'house'],['FISHERMAN HOME',-78,26,8,9,'house'],['BOAT REPAIR',-17,-14,18,14,'workshop'],['TEA ROOM',-67,53,18,17,'shop'],['SERVICE GARAGE',53,-44,24,16,'workshop']]},
 'ghost-frequency':{identity:'Abandoned logging town',limit:90,atmosphere:'overcast',insertion:[-70,-74],south:[-25,-37],center:[5,5],exit:[72,70],preview:{eye:[-5,3,-49],target:[-25,2,4]},surfaces:[road(-25,0,8,156),road(8,24,77,7),lawn(54,-24,54,63),lawn(-61,46,38,49)],addresses:[
  ['OLD POST OFFICE',-45,9,24,16,'ruin',6.4],['RELAY WORKSHOP',57,37,24,20,'workshop'],['ABANDONED SCHOOL',-4,61,38,18,'ruin',6.4],
  ['VACANT COTTAGE',-48,-22,10,9,'ruin'],['VACANT HOME',-46,-54,12,10,'ruin'],['GARDEN SHED',-66,-49,7,8,'workshop'],['VACANT COTTAGE',-66,-23,8,10,'ruin'],['CLOSED GROCERY',-4,-20,22,16,'ruin'],['TIMBER MILL',38,-62,38,18,'hall',6.4],['BURNT COTTAGE',29,39,16,18,'ruin'],['VACANT HOME',-70,14,15,23,'house']]},
 'broken-wing':{identity:'Civil airport terminal and apron',limit:118,atmosphere:'day',insertion:[-93,-92],south:[-56,-65],center:[-8,23],exit:[100,-94],preview:{eye:[25,6,-47],target:[-26,4,-9]},surfaces:[road(-63,-75,84,12),apron(22,8,133,175),road(76,0,24,218),court(-48,-50,82,24),lawn(-94,27,22,134)],addresses:[
  ['KESTREL / ARRIVALS',-48,-15,56,24,'terminal',6.4],['AVIATION FUEL',-49,56,30,22,'workshop'],['CARGO HANGAR',12,81,48,34,'hall',11],
  ['DEPARTURE GATES',-7,8,20,38,'terminal',6.4],['AIRPORT HOTEL',-90,-26,24,34,'apartment',12.8],['RENTAL CARS',-23,-78,28,16,'workshop'],['FLIGHT CONTROL',-70,5,12,12,'tower',12],['AIRPORT FIRE STATION',-80,78,30,22,'workshop']]},
 'market-fire':{identity:'Civilian market quarter',limit:87,atmosphere:'day',insertion:[-73,-69],south:[-12,-42],center:[0,0],exit:[73,64],preview:{eye:[4,3,-39],target:[-15,3,17]},surfaces:[road(-37,0,8,153),road(40,14,8,128),court(0,5,55,61),road(1,-45,81,8),lawn(62,-51,26,28)],addresses:[
  ['SAFFRON / BAKERY',-57,5,26,18,'shop'],['COVERED MARKET',59,19,28,38,'market',5.2],['TOWN LIBRARY',0,57,42,20,'station',9.6],
  ['APARTMENTS / 12',-15,-24,26,16,'apartment',9.6],['SAFFRON CAFE',17,-25,24,14,'shop'],['FAMILY HOMES',-59,39,26,28,'terrace',6.4],['FABRIC & TAILOR',-13,29,26,12,'shop'],['PHARMACY',20,30,20,12,'clinic'],['COURTYARD HOMES',63,-25,22,25,'terrace',6.4],['NEIGHBOURHOOD MOSAIC HALL',-59,-39,26,24,'station',6.4]]},
 'deep-cut':{identity:'Quarry works and abandoned miners’ village',limit:96,atmosphere:'haze',insertion:[-76,-76],south:[-41,-43],center:[4,2],exit:[78,-77],preview:{eye:[21,6,-42],target:[-16,4,24]},surfaces:[road(-42,2,8,164),court(22,13,100,82),road(8,-43,92,8)],addresses:[
  ['MINERS UNION HALL',-61,17,26,28,'ruin',6.4],['STONE CUTTING SHED',58,10,38,34,'hall',8],['QUARRY DISPATCH',0,65,32,18,'workshop'],
  ['EMPTY TERRACE',-65,-29,20,26,'ruin',6.4],['OLD GENERAL STORE',-15,-65,30,15,'ruin'],['CRUSHER CONTROL',31,57,18,20,'workshop'],['MINERS HOME',-59,61,25,17,'ruin'],['SERVICE WORKSHOP',66,-51,26,20,'workshop']]},
 'silent-current':{identity:'Deserted seaside community',limit:93,atmosphere:'overcast',insertion:[70,-76],south:[28,-43],center:[2,14],exit:[-74,-71],preview:{eye:[-8,3,-25],target:[-30,3,28]},surfaces:[road(0,-43,155,8),road(-27,6,7,91),court(1,57,138,16),lawn(58,10,42,41)],addresses:[
  ['OLD TOWN EXCHANGE',-48,7,26,26,'ruin',6.4],['SEAFRONT HOTEL',53,56,36,20,'apartment',12.8],['HARBOUR RADIO',-45,63,28,16,'station',6.4],
  ['BOARDED FISH SHOP',-9,-12,25,16,'ruin'],['EMPTY CAFE',21,-13,21,18,'ruin'],['FISHERMAN COTTAGE',-62,-26,10,9,'house'],['FAMILY HOME',-78,-28,9,10,'house'],['VACANT HOME',-71,20,15,20,'ruin'],['SEA VIEW TERRACE',0,40,38,15,'terrace',6.4],['BOAT SHED',64,-28,30,18,'workshop']]},
 'burn-line':{identity:'Oil refinery and pipe corridors',limit:101,atmosphere:'haze',insertion:[-82,-83],south:[-31,-60],center:[8,7],exit:[81,-79],preview:{eye:[7,6,-42],target:[30,4,24]},surfaces:[road(-48,0,10,179),road(0,-52,150,9),court(27,17,120,114)],addresses:[
  ['REFINERY CONTROL',-71,-8,29,28,'station',6.4],['PUMP HOUSE',65,35,34,28,'hall',8],['CRACKING PLANT',-3,65,50,25,'hall',12],
  ['SAFETY & MEDICAL',-71,45,28,18,'clinic'],['COMPRESSOR HALL',53,-24,37,25,'hall',7],['LOADING OFFICE',-14,-27,28,18,'workshop'],['FIRE STATION',55,-76,38,19,'workshop']]},
 'long-watch':{identity:'Evacuated suburban community',limit:89,atmosphere:'overcast',insertion:[-71,-73],south:[-18,-42],center:[3,5],exit:[73,70],preview:{eye:[-14,3,-36],target:[-50,2,-23]},surfaces:[road(-18,0,8,158),road(23,30,90,8),road(20,-40,81,8),lawn(19,3,39,42),lawn(-59,56,40,26)],addresses:[
  ['CLOSED COMMUNITY CENTRE',-48,15,38,22,'ruin',6.4],['EVACUATED SCHOOL',53,54,44,22,'ruin',6.4],['RANGER OFFICE',-8,65,26,16,'workshop'],
  ['HOME / 18',-50,-18,10,10,'house'],['HOME / 19',-34,-18,8,9,'house'],['HOME / 20',-47,-53,13,11,'ruin'],['HOME / 21',-67,-50,8,9,'ruin'],['HOME / 22',7,-62,11,10,'ruin'],['HOME / 23',42,-64,10,9,'house'],['HOME / 24',59,-64,8,9,'house'],['HOME / 25',61,-7,24,26,'ruin'],['CORNER PHARMACY',15,51,20,17,'clinic']]},
 'dust-trail':{identity:'Desert town and caravan courtyard',limit:95,atmosphere:'haze',insertion:[-74,76],south:[-47,-44],center:[3,0],exit:[73,-76],preview:{eye:[12,3,-36],target:[-10,4,10]},surfaces:[court(2,2,48,43),road(-34,0,7,153),road(31,0,7,153),court(-1,51,106,18)],addresses:[
  ['CARAVAN INN',-59,13,32,28,'terrace',6.4],['TOWN GARAGE',59,-21,34,24,'workshop'],['SURVEY OFFICE',8,73,36,18,'station',6.4],
  ['TEA HOUSE',0,-30,26,15,'shop'],['TEXTILES',0,32,26,15,'shop'],['COURTYARD HOME',-54,-24,13,11,'house'],['SMALL HOME',-73,-24,8,9,'house'],['COURTYARD HOME',-60,56,27,23,'terrace',6.4],['OLD SCHOOL',58,42,30,32,'ruin',6.4],['POTTERY',-6,-66,32,18,'workshop']]},
 'sealed-cargo':{identity:'Container port and bonded warehouses',limit:101,atmosphere:'day',insertion:[-80,-83],south:[-40,-48],center:[4,2],exit:[84,-77],preview:{eye:[-25,7,-54],target:[9,4,14]},surfaces:[apron(0,10,173,157),road(-67,0,9,180),road(0,-64,167,10)],addresses:[
  ['CUSTOMS INSPECTION',-37,-22,38,22,'station',6.4],['BONDED WAREHOUSE',65,42,36,49,'hall',10],['CARGO OPERATIONS',-32,66,39,23,'workshop'],
  ['TRUCK SERVICE',52,-43,36,24,'workshop'],['DOCKERS CANTEEN',-77,19,20,27,'shop'],['PACKING HALL',-35,21,35,27,'hall',7]]},
 'hard-reset':{identity:'City centre and civic plaza',limit:94,atmosphere:'day',insertion:[-78,-79],south:[-29,-40],center:[3,4],exit:[85,80],preview:{eye:[2,3,-6],target:[-32,9,32]},surfaces:[road(-33,0,10,165),road(39,0,10,166),road(0,-44,150,10),road(0,43,150,10),court(2,3,53,65)],addresses:[
  ['CITY EXCHANGE',-61,7,38,46,'apartment',19.2],['CIVIC DATA CENTRE',66,5,35,51,'terminal',9.6],['MUNICIPAL LIBRARY',1,66,48,24,'station',12.8],
  ['CENTRAL ARCADE',0,-24,48,14,'market',6.4],['OFFICES / SOUTH',-61,-64,35,24,'apartment',12.8],['OFFICES / EAST',64,-62,35,26,'apartment',16],['APARTMENTS / NORTH',-61,65,36,27,'apartment',16],['CITY HOTEL',63,65,33,29,'apartment',19.2]]},
 'last-approach':{identity:'Remote airstrip and aircraft maintenance base',limit:112,atmosphere:'haze',insertion:[-90,92],south:[-56,-67],center:[-6,4],exit:[82,-92],preview:{eye:[20,5,-30],target:[-31,5,37]},surfaces:[road(60,0,21,206),apron(9,4,74,166),road(-56,0,8,175),lawn(-86,7,36,129)],addresses:[
  ['FLIGHT OPERATIONS',-34,-35,30,23,'station',6.4],['AIRCRAFT MAINTENANCE',-26,40,52,44,'hangar',12],['BEACON STATION',23,86,22,14,'workshop'],
  ['RESCUE SERVICES',-81,-48,32,24,'workshop'],['PILOTS LOUNGE',-82,42,16,13,'house'],['SPARES STORE',-32,83,32,16,'hall',6.4],['FLIGHT TOWER',-24,1,11,11,'tower',12]]},
 'white-flag':{identity:'Coastal neighbourhood and civilian hospital',limit:92,atmosphere:'day',insertion:[-73,-75],south:[-27,-41],center:[3,8],exit:[74,-75],preview:{eye:[12,3,-42],target:[29,4,27]},surfaces:[road(-29,0,8,155),road(24,-38,95,8),court(35,16,85,78),lawn(-60,13,38,55)],addresses:[
  ['AID REGISTRATION',-55,55,35,22,'clinic'],['BREAKWATER HOSPITAL',53,25,37,45,'clinic',6.4],['HOSPITAL PHARMACY',12,63,26,20,'clinic'],
  ['FAMILY HOME',-56,-18,28,18,'terrace',6.4],['FAMILY HOME',-56,-51,12,11,'house'],['SMALL HOME',-77,-49,8,9,'house'],['CORNER KIOSK',-54,-73,7,6,'shop'],['SEASIDE CAFE',4,-61,27,18,'shop'],['BUS DEPOT',52,-63,31,20,'station',6.4],['CLINIC ANNEX',12,30,22,21,'clinic']]},
 'chain-reaction':{identity:'Steelworks production campus',limit:103,atmosphere:'overcast',insertion:[-81,-84],south:[-33,-55],center:[4,6],exit:[86,-83],preview:{eye:[9,5,-45],target:[26,6,33]},surfaces:[road(-47,0,9,185),road(7,-49,98,9),court(22,16,119,130)],addresses:[
  ['FOUNDRY ADMINISTRATION',-72,-10,30,28,'station',9.6],['ROLLING MILL',58,15,45,64,'hall',12],['ASSEMBLY HALL',-9,68,54,28,'hall',10],
  ['MACHINE SHOP',-6,-22,34,25,'workshop',6.4],['WORKERS CANTEEN',-72,49,30,26,'shop'],['QUALITY CONTROL',64,-67,34,22,'workshop'],['BOILER HOUSE',-9,35,26,18,'hall',8]]},
 'open-horizon':{identity:'Occupied hill town and old civic centre',limit:99,atmosphere:'haze',insertion:[0,-82],south:[-37,-44],center:[2,1],exit:[79,76],preview:{eye:[20,4,-50],target:[-10,6,24]},surfaces:[road(-34,0,9,171),road(34,0,9,170),court(0,10,47,73),court(1,56,132,17)],addresses:[
  ['OCCUPIED SCHOOL',-64,-4,38,36,'ruin',9.6],['DISTRICT OFFICES',63,20,36,46,'station',9.6],['OLD TOWN HALL',0,78,49,22,'station',12.8],
  ['HORIZON HOTEL',-60,57,34,29,'apartment',12.8],['MARKET HALL',0,-32,44,18,'market',5.2],['APARTMENTS / SOUTH',-59,-57,34,25,'terrace',6.4],['APARTMENTS / EAST',63,-42,35,22,'terrace',6.4],['GARDEN HOME',64,67,13,11,'house'],['SMALL HOME',84,64,8,10,'house']]},
}
