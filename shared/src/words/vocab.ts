/**
 * The Word Lodge's vocabulary.
 *
 * Hand-written rather than lifted from a system dictionary: those are full of `azote` and
 * `cyath` and carry no plurals, which makes for unfair puzzles and worse, unfair rejections.
 *
 * Two lists do the work. `ANSWERS` holds words a puzzle is allowed to *be* — common, friendly,
 * no proper nouns. `EXTRA` holds words a player is allowed to *guess* — much wider, including
 * the plurals and past tenses people reach for first. A guess outside both is turned away
 * without costing a turn (see `wordle.ts`), so the cost of a gap here is a moment's confusion,
 * never a lost game.
 *
 * Everything is stored as space-separated strings and split once at module load: it keeps the
 * single-file build small and the diffs readable.
 */

const split = (s: string): string[] => s.trim().split(/\s+/);

/** Words a five-letter puzzle can be built from. */
const RAW_ANSWERS = split(`
about above acorn actor adopt adult after again agent agree ahead alarm album alert alike alive
allow alone along aloud amber angel anger angle ankle apart apple apron arena argue arise armor
arrow aside asset avoid awake award aware badge baker basic basin beach beard beast begin being
bench berry birch birth black blade blame blank blast blaze bleak blend bless blind blink block
bloom blown blues bluff blunt blush board boast bonus boost booth brain brake brand brass brave
bread break breed brick bride brief bring brisk broad broke brook broom brown brush build built
bunch burst cabin cable camel canal candy canoe cargo carol carry carve catch cause cedar chain
chair chalk charm chart chase cheap cheer chess chest chief child chill china choir chose chunk
churn cider civic civil claim clamp clash clasp class clean clear clerk click cliff climb cling
cloak clock close cloth cloud clown clump coach coast cobra cocoa color couch cough could count
court cover crack craft crane crash crate crawl crazy cream creek crept crest crisp cross crowd
crown crust curve cycle daily dairy dance dated dealt debut decay delay delta dense depth diary
dirty dizzy dodge doing donor doubt dough dozen draft drain drama drank drawn dream dress dried
drift drill drink drive drone drove drown drums dryer eager eagle early earth eight elbow elder
elect elite empty enemy enjoy enter entry equal error essay event every exact exist extra fable
faint fairy faith false fancy fatal fault favor feast fence ferry fever fiber field fiery fifth
fifty fight final finch first flake flame flash fleet flesh flick fling float flock flood floor
flour flown fluid flush flute focus foggy force forge forth forty forum found frame fresh fried
frost frown fruit fudge fully funny gauge genre ghost giant given glade glass gleam globe gloom
glory glove going goose grace grade grain grand grant grape graph grasp grass grave gravy graze
great greed green greet grill grind groan groom group grove growl grown guard guess guest guide
guilt habit happy harsh haunt heart heavy hedge hello hence hobby honey honor horse hotel hound
house hover human humid humor hurry ideal image imply index inner input irony issue ivory jelly
jewel joint jolly judge juice juicy knack knead kneel knelt knife knock known koala label labor
lance large laser later laugh layer learn lease least leave ledge lemon level lever light lilac
limit linen liner liver llama local lodge lofty logic loose lorry lotus loyal lucky lunar lunch
lying magic major maker mango maple march marsh match maybe mayor meant medal media melon mercy
merge merit merry metal meter midst might mimic mince minor minus mirth mixed model moist money
month moose moral motor mound mount mourn mouse mouth movie music naked nasty naval nerve never
newly night noble noise noisy north notch noted novel nurse oasis occur ocean offer often olive
onion onset opera orbit order organ otter ought ounce outer owner oxide paint panel panic paper
parka party pasta patch patio pause peace peach pearl pedal penny perch petal phase phone photo
piano picky piece pilot pinch pitch pixel pizza place plain plane plank plant plate plaza plead
pleat plume plush point polar porch pouch pound power press price pride prime print prior prize
probe prone proof proud prove prune pulse punch pupil puppy purse quack quail quake queen query
quest queue quick quiet quilt quirk quite quota radar radio raise rally ranch range rapid ratio
raven reach ready realm rebel refer reign relax relay renew reply reset resin rhyme ridge rifle
right rigid rinse ripen risen risky rival river roast robin robot rocky roost rough round route
royal rugby ruler rumor rural sadly saint salad salon salty sandy sauce scale scarf scene scent
scold scoop scope score scout scrap screw scrub seize sense serve seven shade shaft shake shall
shame shape share shark sharp shawl sheep sheer sheet shelf shell shine shiny shirt shock shone
shore short shout shown shrub shrug sight silly since siren sixty skate skier skill skirt skull
slate sleek sleep sleet slice slide slope small smart smash smell smile smoke snack snail snake
sneak sniff snore snowy solar solid solve sorry sound south space spade spare spark speak spear
speed spell spend spice spike spill spine spoke spoon sport spout spray sprig squad stack staff
stage stain stair stake stale stalk stamp stand stare stark start state steak steal steam steel
steep steer stern stick stiff still sting stock stole stone stood stool stoop store storm story
stove strap straw stray strip stuck study stuff stump style sugar suite sunny super surge sweat
sweep sweet swell swift swing swirl sword syrup table tacky taken tales talon tango tasty teach
teeth tempo tenth thank theft their theme there these thick thief thigh thing think third thorn
those three threw throb throw thumb tidal tiger tight timer tired title toast today token tooth
topic torch total touch tough towel tower trace track trade trail train trait tramp trash tread
treat trend trial tribe trick tried trout truck truly trunk trust truth tulip tunic turbo tutor
twice twine twist uncle under union unite until upper upset urban usage usual vague valid value
valve vapor vault venue verse vigor villa vinyl viola vivid vocal voice vowel wafer wagon waist
waltz waste watch water weary weave wedge weigh weird whale wheat wheel where which while whirl
whisk white whole whose widen width windy witch woman women world worry worse worth would wound
woven wrist write wrong wrote yacht yearn yeast yield young yours youth zebra
`);

/**
 * Also accepted as a guess, never used as an answer: plurals, past tenses and the slightly less
 * common words people try early. Being generous here costs nothing and spares the worst moment
 * a word game has.
 */
const RAW_EXTRA = split(`
abbey abide ached acids acorns acres acted adage added adept admit adobe adore aerial afoot
aglow aided aimed aired aisle alder algae alias alley alloy altar amass amend amide amiss among
ample amuse angry anime annex annoy antic anvil aorta aphid arbor ardor areas arena armed armor
aroma array arrow arson artsy ashen ashes aspen atlas atoll atoms attic audio augur aunts aurum
autos avail avert awoke axial axles bacon badly bagel baked baker bales balmy banjo banks barge
barks barns baron based bases basil basis bathe baths baton batch bayou beads beaks beams beans
bears beats beech beefy beeps beets began beget belly belts bends bento bents bezel bided bikes
biome birds bison bites bitty blabs blade blahs blared blast blebs blimp blips blobs blocs blogs
bloke blurb blurt boats bobby bodes bogus boils bolts bombs bonds boned bones bongo bonny books
boots bored bores borne bosom bossy bough bound bowed bowls boxed boxer boxes brace braid brain
brats brawl brawn brays bream bred brews briar bribe bries brine brink briny broth brows bruin
brunt bucks buddy budge buggy bugle built bulbs bulge bulky bulls bumps bumpy bunny bunks buoys
burly burns burnt buses bushy busts butte buyer buzzy bylaw byway cabby cabin cacao cacti caddy
cadet cafes caged cages cairn cakes calms camps canal candy caned canes canny canon caped capes
capon carat cards cared cares carob carts casks caste casts catty caulk caved caves cease cedar
cells cents chaps chars chats cheek chefs chews chewy chick chico chime chimp chins chips chirp
chive chock choke chomp chops chord chore chuck chute cinch circa cited cites civet clack claim
clams clang clank claps clays clean cleat clefs clerk clews climb clink clips clive cloak clods
clogs clomp clone clops clots clove clubs clues clung coals coats cobra cocoa codes coils coins
coked colas colds colon colts combo comet comfy comic comma coned cones conic cooks cools coops
coped copes coral cords cores corks corns corny costs cosy couch cough coupe coups cours cover
covet covey cowed cowls crabs crags cramp crane crank craze crazy credo crews cribs cried cries
crime crimp croak crock crocs crone crony crook croon crops crude cruel crumb crush crypt cubed
cubes cubic cuffs cults cumin cupid curbs curds cured cures curio curls curly curry curse curvy
cuter cutie cycle cysts dabs dairy daisy dales dames damps dandy dared dares darts dated dates
datum daunt dawns deals deans dears debit debts decaf decal decks decor decoy decry deeds deems
deeps defer deify deign deity delis dells demos demur denim dents depot derby desks deter detox
deuce devil dewey dials diced dices dicey diets digit dimes diner dines dingy dinky dints diode
dirge disco discs ditch ditto divan dived diver dives divot dizzy docks dodge doers doffs doily
doles dolls dolly domed domes donut dooms doors doses doted dotes doubt dowel downs dowry dozed
dozen drabs drags drape drawl draws drays dregs dress dries drips drone drool droop drops dross
drugs drums drunk dryly ducks ducts dudes duels duets dukes dulls dully dummy dumps dumpy dunes
dusks dusky dusts dusty duvet dwarf dwell dyers dying eager eagle eared earls earns eased easel
eases eaten eater ebony echos edged edges edict edify eerie egret eight eject elate elbow elder
elect elegy elfin elide elite elope elude elves embed ember emcee emits empty emu enact ended
endow endue enemy enjoy ennui enrol ensue enter entry envoy epoch epoxy equal equip erase erect
erode erred error erupt essay ether ethic ethos evade evens event evict evoke exact exalt excel
exert exile exist exits expel expos extol exude exult eyed eying fable faced faces facet fades
fails faint fairs faith faked faker fakes falls famed fangs fared fares farms fates fatty fauna
favor fawns faxed faxes fazed fears feats feeds feels feign feint fells felon femur fends ferns
fetal fetch feted fetid feuds fewer fibre ficus fiefs fiend fifes fifth fifty figs filch filed
files fills filly films filmy filth finch finds fined finer fines finis finks fired fires firms
firth fishy fists fitly fives fixed fixer fixes fjord flabs flack flags flail flair flaky flank
flaps flare flats flaws flaxy flays fleas fleck flees flier flies flings flint flips flirt flits
flock floes flogs flops flora floss flows flubs flues fluff fluke flume flung flunk fluty flyer
foals foams foamy focal foils foist folds folio folks folly fonts foods fools foots foray forbs
fords forks forms forte forts fossa fouls fowls foxes foyer frail frank frays freak freed frees
freon fries frill frisk frizz frock frogs fronds front froth frown froze fryer fuels fumed fumes
funds fungi funks funky furry furze fused fuses fussy fusty futon fuzzy gable gaffe gaily gains
gaits galas gales galls gamed gamer games gamma gangs gaped gapes gates gaudy gauze gavel gawks
gawky gazed gazer gazes gears gecko geese gelds gelee gemmy genes genie genus germs ghoul gibes
gifts gilds gills gilts gipsy girds girls girth gists given giver gives gizmo glade glads glare
glaze glean glens glide glint gloat globs glops gloss glows glues gluey glyph gnarl gnash gnats
gnome goads goals goats godly gofer gongs gonna goods goody gooey goofy goons goose gorge gorse
gouge gourd gowns grabs grads graft grail grams grape grasp grate greys grids griefs grime grimy
grins griot gripe grips grist grits groat grogs groin grope gross grout grove growl grubs gruel
gruff grump grunt guano guava guild guile gulch gulfs gulls gully gulps gumbo gummy gusto gusts
gusty gutsy gyros habit hacks hails hairs hairy hales halls halos halts halve hands handy hangs
hanky hardy hares harks harms harps harpy hasty hatch hated hater hates hauls haven havoc hawks
hayed hazel hazes heads heady heals heaps heard hears heart heath heave hefty heirs heist helix
hello helms helps hemps herbs herds heron hertz hewed hides hiked hiker hikes hills hilly hilts
hinds hinge hints hippo hired hires hitch hived hives hoard hoary hoaxy hobos hocks hoist holds
holes holly homer homes honed hones honks hoods hooks hoops hoots hopes horde horns horny hosed
hoses hosts hotly hound hours house hovel howdy howls hubby huffs huffy huger hulks hulls human
humid humps humus hunch hunks hunts hurls hurts husks husky hutch hydra hyena hymns hyped hyper
icier icily icing icons ideal ideas idled idler idles idols igloo image imbue impel imply inane
inapt inbox incur index inept inert infer ingot inked inlay inlet inner input inset inter intro
inure irate irked irons irony isles issue itchy items ivied ivory jacks jaded jades jails jammy
japan jawed jeans jeeps jeers jelly jerks jerky jests jetty jewel jiffy jilts jinks jived jives
jocks joins joint joist joker jokes jolly jolts joust jowls joyed judge juice juicy jumbo jumps
jumpy junks junta juror karat karma kayak kebab keels keeps kelps kempt kerns kettle keyed khaki
kicks kiddo kilns kilos kilts kinds kings kinks kinky kiosk kites kitty kiwis klutz knack knead
kneed kneel knees knell knelt knits knobs knock knoll knots known knows koala kudos kudzu label
laced laces lacks laden lades ladle lager laity lakes lambs lamed lamps lance lands lanes lanky
lapel lapse larch lards large larks larva lased laser lasso lasts latch lathe laths latte lauds
lawns laxer layer leads leafy leaks leaky leans leaps leapt learn leash least leave ledge leech
leeks leers leery lefts legal leggy legit lemon lemur lends lento leper levee lever levis liars
libel licks liens lifts light liked liken liker likes lilac lilts limbo limbs limed limes limit
limos limps lined linen liner lines lingo links lints lions lipid lisps lists liter lithe liver
livid llama loads loafs loams loamy loans lobby lobes local locks locus lodes lodge lofts lofty
logic logos loins lolls loner longs looks looms loons loops loopy loose loots loped lopes lords
lorry loser loses lotus louse lousy louts loved lover loves lowed lower lowly loyal lucid lucky
lumen lumps lumpy lunar lunch lunge lungs lurch lured lures lurid lurks lusty lutes lying lymph
lyric macaw maced maces macho macro madly mafia magic magma maids mails maims mains maize major
maker makes males malls malts mamba mambo mamma manes mange mango mangy mania manic manor manse
maple march mares marks marsh marts masks mason masts match mated mates matte mauls mauve mavens
maxim mayan mayas maybe mayor mazes meads meals mealy means meant meats meaty mecca medal media
medic meets melds melee melon melts memos mends menus meows mercy merge merit merry meshy mesas
messy metal meted meter metro miaow micas micro midge midst miens might milds miler miles milks
milky mills mimed mimes mimic minds mined miner mines mingy minim minks minor mints minty minus
mired mires mirth miser missy mists misty mites mitre mitts mixed mixer mixes moans moats mocha
mocks modal model modem modes moist molar molds moldy moles molls molts moms mommy money monks
month moods moody mooed moons moors moose moped mopes moral moray morel morph mossy motel motes
moths motif motor motto mould mound mount mourn mouse mousy mouth moved mover moves movie mowed
mower mucks mucky mucus muddy muffs mufti muggy mulch mules mulls mummy mumps munch mural murky
mused muses mushy music musky musty muted mutes mutts myrrh myths nacho nadir naive naked named
namer names nanny napes nappy narcs nasal nasty natal naval navel naves nears neath necks needs
needy negus neigh nerds nerdy nerve nests netty never newel newer newly newsy newts nexus nicer
niche nicks niece nifty night nines ninja ninny ninth nippy niter nixed nobby noble nobly nodal
nodes noels noise noisy nomad nooks noons noose norms north nosed noses nosey notch noted notes
nouns novae novel noway nudge nudes nuked nukes nulls numbs nurse nutty nylon nymph oaken oakum
oared oases oasis oaten oaths obese obeys occur ocean ocher octal octet odder oddly odors offal
offer often ogled ogles ogres oiled oiler oinks okapi okays olden older olive omega omens omits
onion onset onto onyx oozed oozes opals opens opera opine opted optic orals orate orbit orbs
orcas order organ otter ought ounce outed outer ovals ovary ovate ovens overs overt owing owlet
owned owner oxide ozone paced paces packs pacts paddy padre pagan paged pager pages pails pains
paint pairs paled paler pales palms palmy palsy panda paned panel panes pangs panic pansy pants
papas papaw papal paper parch pared pares parka parks parry parse parts party pasta paste pasts
pasty patch pater paths patio patsy patty pause paved paver paves pawed pawns payed payee payer
peace peach peaks peals pearl pears pecan pecks pedal peeks peels peeps peers pelts penal pence
pends penny peony peppy perch peril perks perky pesky pesos pesto petal peter petty phase phone
phony photo phyla piano picks picky picts piece piers pies piety piggy piked pikes pilaf piled
piles pills pilot pimps pinch pined pines piney pings pinks pinky pinto pints pions pious piped
piper pipes pipit pique pitas pitch pithy piton pivot pixel pixie pizza place plaid plain plait
plane plank plans plant plate plays plaza pleas pleat plebe plied plies plods plods plops plots
plows ploys plumb plume plump plums plunk plush poems poesy poets point poise poked poker pokes
polar poled poles polio polka polls polyp pomps ponds pones pooch poods pools poppy porch pored
pores porky ports posed poser poses posit posse posts potty pouch pound pours pouts power prank
prawn prays preen prep press preys price pricy pride pried pries prime primp print prior prism
privy prize probe prods prole promo prone prong proof props prose prosy proud prove prowl proxy
prude prune pryer psalm pubic pucks pudgy puffs puffy pugs pukes pulls pulps pulpy pulse pumas
pumps punch punks punts pupae pupal pupil puppy puree purer purge purls purrs purse pushy putty
pygmy pylon pyres quack quads quail quake qualm quark quart quash quasi quays queen queer quell
query quest queue quick quiet quill quilt quips quire quirk quite quits quota quote quoth rabbi
raced racer races racks radar radii radio radon rafts raged rages raids rails rains rainy raise
rajah raked rakes rally ramps ranch rands range rangy ranks rants raped rapid rarer rased raspy
rated rater rates ratio ratty raved ravel raven raves rayon razed razes razor reach react reads
ready realm reals reams reaps rears rebel rebus rebut recap recon recta recur redid redos reeds
reedy reefs reeks reels refer refit regal rehab reign reins relax relay relic remit remix renal
rends renew rents repay repel reply rerun reset resin rests retch retry reuse revel revue rheas
rhino rhyme ribby riced rices ricks rider rides ridge rifle rifts right rigid rigor riled riles
rills rimed rimes rinds rings rinks rinse riots ripen riper risen riser rises risks risky rites
ritzy rival rived riven river rivet roach roads roams roans roars roast robed robes robin robot
rocks rocky rodeo rogue roils roles rolls roman romps roods roofs rooks rooms roomy roost roots
roped ropes roses rosin rotas rotor rouge rough round rouse route routs roved rover roves rowdy
rowed rower royal rubes ruble ruddy ruder ruffs rugby ruing ruled ruler rules rumba rumen rummy
rumor rumps runes rungs runny runts rupee rural ruses rusks rusts rusty saber sable sabre sacks
sadly safer safes sagas sager sages saggy sahib sails saint salad sales sally salon salsa salts
salty salve salvo samba sandy saner sappy sarge sassy satin satyr sauce saucy saute saved saver
saves savor savvy sawed scabs scads scald scale scalp scaly scamp scans scant scare scarf scars
scary scats scene scent schwa scion scoff scold scone scoop scoot scope score scorn scour scout
scowl scram scrap scree screw scrim scrip scrub scuba scuds scuff scull scums scurf seals seams
seamy sears seats sedan sedge seeds seedy seeks seems seeps seers seize sells semis sends sense
sepal sepia serfs serge serum serve setup seven sever sewed sewer sexes shack shade shads shady
shaft shags shake shaky shale shall shame shams shank shape shard share shark sharp shave shawl
sheaf shear sheds sheen sheep sheer sheet sheik shelf shell shied shies shift shill shims shine
shins shiny ships shire shirk shirt shoal shock shoed shoes shone shook shoos shoot shops shore
shorn short shots shout shove shown shows showy shred shrew shrub shrug shuck shuns shunt shush
shuts shyer shyly sibyl sided sides sidle siege sieve sifts sighs sight sigma signs silks silky
sills silly silos silts silty since sinew singe sings sinks sinus sired siren sires sisal sites
sitar sixes sixth sixty sized sizer sizes skate skeet skews skids skied skier skies skiff skill
skimp skims skins skips skirt skits skulk skull skunk slabs slack slags slain slake slams slang
slant slaps slash slate slats slave slays sleds sleek sleep sleet slept slews slice slick slide
slily slime slimy sling slink slips slits slobs sloes slogs sloop slope slops slosh sloth slots
slows slugs slump slung slunk slurp slurs slush slyer slyly smack small smart smash smear smell
smelt smile smirk smite smith smock smoke smoky smote snack snafu snags snail snake snaky snaps
snare snarl sneak sneer snide sniff snipe snips snits snobs snoop snoot snore snort snots snout
snows snowy snubs snuff snugs soaks soaps soapy soars sober socks sodas sofas softy soggy soils
solar soled soles solid solos solve sonar songs sonic sooth sooty sophs sorer sorry sorts souls
sound soups soupy sours south sowed sower space spade spaed spans spare spark spars spasm spate
spawn spays speak spear speck specs speed spell spelt spend spent sperm spews spice spicy spied
spiel spies spike spiky spill spilt spine spins spiny spire spiry spite spits splat splay split
spoil spoke spoof spook spool spoon spore sport spots spout spray spree sprig spuds spume spunk
spurn spurs spurt squab squad squat squib squid stack staff stage stags staid stain stair stake
stale stalk stall stamp stand stank staph stare stark stars start stash state stave stays stead
steak steal steam steed steel steep steer stein stems steps stern stews stick stied sties stiff
stile still stilt sting stink stint stirs stoat stock stoic stoke stole stomp stone stony stood
stool stoop stops store stork storm story stout stove stows strap straw stray strep strew strip
strut stubs studs study stuff stump stung stunk stuns stunt styes style styli suave sucks sudsy
suede sugar suing suite suits sulks sulky sully sumac sumps sunny sunup super surer surfs surge
surly swabs swags swain swami swamp swans swaps sward swarm swash swath swats sways swear sweat
sweep sweet swell swept swift swigs swill swims swine swing swipe swirl swish swiss swoon swoop
swops sword swore sworn swung synod syrup tabby table taboo tacit tacks tacky taffy tails taint
taken taker takes tales talks talky tally talon tamed tamer tames tamps tango tangy tanks taped
taper tapes tapir tardy tared tares tarns tarot tarps tarry tarts tasks taste tasty tatty taunt
taupe tauts tawny taxed taxer taxes teach teaks teals teams tears teary tease teats techs teems
teens teeny teeth tells tempo temps tempt tench tends tenet tenor tense tenth tents tepee tepid
terms terns terse tests testy texts thank thaws theft their theme thens there therm these theta
thick thief thigh thine thing think thins third thong thorn those three threw throb throe throw
thrum thuds thugs thumb thump thyme tiara tibia ticks tidal tided tides tiers tiger tight tikes
tilde tiled tiler tiles tills tilts timed timer times timid tinge tings tinny tints tipsy tired
tires titan tithe title titan toads toast today toddy toffy togas toils toked token tokes tolls
tombs tomes tonal toned toner tones tongs tonic tools tooth toots topaz topic torch torso torte
total toted totem totes touch tough tours touts towed towel tower towns toxic toxin trace track
tract trade trail train trait tramp traps trash trawl trays tread treat treed trees treks trend
tress triad trial tribe trice trick tried tries trike trill trims trine triod tripe trips trite
troll tromp troop trope trots trout truce truck trued truer truly trump trunk truss trust truth
tryst tubal tubas tubby tubed tuber tubes tucks tufts tulip tulle tumid tummy tumor tunas tuned
tuner tunes tunic turbo turfs turns tusks tutor tutus tweak tweed tweet twerp twice twigs twill
twine twins twirl twist twixt tying tyke typed types typos tyros udder ulcer ulnae ultra umber
umbra unapt unbar uncle uncut under undid undue unfed unfit unify union unite units unity unlit
unmet unpin unsay unset untie until unwed unzip upend upped upper upset urban urged urges urine
usage usher using usual usurp utter vague vales valet valid valor value valve vamps vanes vapid
vapor vases vaste vault vaunt veals veers vegan veils veins velar veldt venal vends venom vents
venue verbs verge verse verso verve vesta vests vetch vexed vexes vials viand vibes vicar viced
video viewy vigil vigor viler villa vinca vined vines vinyl viola viper viral vireo virus visas
vised vises visit visor vista vital vivid vixen vocal vodka vogue voice voids voila voile voted
voter votes vouch vowed vowel vulgo wacky waded wader wades wafer wafts waged wager wages wagon
waifs wails waist waits waive waked waken wakes waled wales walks walls waltz wands waned wanes
wanly wants wards wares warms warns warps warts warty washy wasps waste watch water watts waved
waver waves waxed waxen waxes weald weans wears weary weave webby wedge weeds weedy weeks weeps
weigh weird welds wells welsh welts wench wends whack whale whams wharf wheat wheel whelk whelp
whens where whets which whiff while whims whine whiny whips whirl whirs whisk white whizz whole
whoop whorl whose widen wider widow width wield wilds wiles wills wilts wimpy wince winch winds
windy wined wines wings winks winos wiped wiper wipes wired wires wiser wisps wispy witch withe
witty wives wizen woken wolds wolfs woman wombs women wonky wonts woods woody wooed wooer wools
wooly woozy words wordy works world worms wormy worry worse worst worth would wound woven wowed
wrack wraps wrath wreak wreck wrens wrest wring wrist write writs wrong wrote wrung wryly xenon
xylem yacht yanks yappy yards yarns yawns yearn years yeast yells yelps yeses yield yodel yogas
yogis yoked yokel yokes yolks young yours youth yowls yucca yucky yummy zeals zebra zesty zincs
zippy zonal zoned zones zooms
`);

/** Shorter and longer words, used by the crossword and the Spelling Bee. */
const RAW_BY_LEN: Record<number, string[]> = {
  3: split(`
    ace act add ado age ago aid ail aim air ale all alp amp and ant any ape apt arc are ark arm art ash ask
    asp ate awe axe bad bag ban bar bat bay bed bee beg bet bid big bin bit boa bog bow box boy bud bug bun
    bus but buy cab cad cam can cap car cat caw cob cod cog con coo cop cot cow coy cry cub cue cup cur cut
    dab dam day den dew did die dig dim din dip doe dog don dot dry dub dud due dug duo dye ear eat ebb eel
    egg ego elf elk elm emu end eon era err eve ewe eye fad fan far fat fax fed fee fen few fib fig fin fir
    fit fix flu fly foe fog for fox fro fry fun fur gag gal gap gas gel gem get gig gin gnu goo got gum gun
    gut guy gym had hag ham has hat hay hem hen her hew hey hid hig him hip his hit hob hoe hog hop hot how
    hub hue hug hum hut ice icy ill imp ink inn ion ire irk its ivy jab jam jar jaw jay jet jig job jog jot
    joy jug jut keg key kid kin kit lab lad lag lap law lax lay led leg let lid lie lip lit lob log lot low
    mad man map mar mat maw may men met mew mid mix mob mop mow mud mug mum nag nap net new nib nil nip nit
    nod nor not now nun nut oak oar oat odd ode off oil old one opt orb ore our out owe owl own pad pal pan
    par pat paw pay pea peg pen pep per pet pew pie pig pin pit ply pod pot pro pry pub pug pun pup put rag
    raj ram ran rap rat raw ray red ref rib rid rig rim rip rob rod roe rot row rub rue rug rum run rut rye
    sag sap sat saw say sea see set sew she shy sip sir sit six ski sky sly sob sod son sow soy spa spy sty
    sub sue sum sun tab tad tag tan tap tar tax tea ten the thy tic tie tin tip toe ton too top tow toy try
    tub tug two urn use van vat vet vex via vie vim vow wad wag war was wax way web wed wee wet who why wig
    win wit woe wok won woo wry yak yam yap yaw yes yet yew yip you zap zed zen zig zip zoo
  `),
  4: split(`
    able ache acid acre afar aged ages agog ahem aide ajar akin alas ally aloe also alto amid ammo ands ankh
    ante ants apex apse aqua arch arcs area aria arid arms army arts aunt aura auto avid away awed axes axis
    axle babe baby back bade bags bail bait bake bald bale balk ball balm band bane bang bank bans barb bard
    bare bark barn bars base bash bask bass bath bats bead beak beam bean bear beat beds beef been beep beer
    bees beet bell belt bend bent berm best beta bias bibs bide bids bike bile bill bind bins bird bite bits
    blab blah bled blew blip blob bloc blot blow blue blur boar boat bode body bogs boil bold bolt bomb bond
    bone bong bony book boom boon boos boot bore born boss both bout bowl bows boys brag bran bras brat bray
    bred brew brig brim brow buck buds buff bugs bulb bulk bull bump bums bunk buns buoy burn burr bury bush
    bust busy butt buys buzz byte cabs cafe cage cake calf call calm came camp cane cans cape caps card care
    carp cars cart case cash cask cast cats cave cell cent chap char chat chef chew chic chin chip chop chow
    cite city clad clam clan clap claw clay clef clip clod clog clop clot cloy club clue coal coat coax cobs
    cock coco coda code cods coed cogs coil coin coke cold colt coma comb come cone cook cool coop cope cops
    copy cord core cork corn cost cosy cots coup cove cowl cows cozy crab crag cram crew crib crop crow crux
    cube cubs cues cuff cull cult cups curb curd cure curl curt cusp cute cyst dabs daft dale dame damp dams
    dare dark darn dart dash data date dawn days daze dead deaf deal dean dear debt deck deed deem deep deer
    deft defy dell demo dens dent deny desk dews dial dice died dies diet digs dime dims dine ding dins dint
    dips dire dirt disc dish disk dive dock docs dodo doer does dogs dole doll dolt dome done doom door dope
    dork dorm dose dote dots dove down doze drab drag dram drat draw drew drip drop drug drum dual duck duct
    dude duds duel dues duet duke dull duly dumb dump dune dung dunk dusk dust duty dyed dyes each earl earn
    ears ease east easy eats ebbs echo eddy edge edgy edit eels eggs egos eking elks ells elms else emir emit
    ends envy eons epic eras erst etch euro even ever eves evil ewes exam exes exit eyed eyes fact fade fads
    fail fair fake fall fame fang fans fare farm fast fate fawn faze fear feat feed feel fees feet fell felt
    fend fern fest fete feud fibs figs file fill film find fine fins fire firm fish fist fits five fizz flab
    flag flak flan flap flat flaw flax flea fled flee flew flex flip flit floe flog flop flow flub flue flux
    foal foam foes fogs foil fold folk fond font food fool foot ford fore fork form fort foul four fowl foxy
    fray free fret frog from fuel full fume fumy fund funk furl furs fury fuse fuss fuzz gabs gaff gage gags
    gain gait gala gale gall game gang gape gaps garb gash gasp gate gave gawk gaze gear geek gees gels gelt
    gems gene gent germ gets gift gigs gild gill gilt gins gird girl gist give glad glee glen glib glob glow
    glue glum glut gnat gnaw goad goal goat gobs gods goes gold golf gone gong good goof gore gory gosh gout
    gown grab grad gram gray grew grid grim grin grip grit grow grub gulf gull gulp gums gush gust guts guys
    hack hags hail hair hale half hall halo halt hams hand hang hard hare hark harm harp hash hast hate hats
    haul have hawk haze hazy head heal heap hear heat heed heel heft heir held helm help hemp hens herb herd
    here hero hers hewn hick hide high hike hill hilt hind hint hips hire hiss hits hive hoax hobo hock hoes
    hogs hold hole holy home hone honk hood hoof hook hoop hoot hope hops horn hose host hour hove howl hubs
    hues huff huge hugs hula hulk hull hump hums hung hunk hunt hurl hurt hush husk huts hymn hype icon idea
    idle idly idol iffy inch inks inky inns into ions iota iris iron isle itch item jabs jack jade jail jams
    jars jaws jazz jeep jeer jell jerk jest jets jibe jigs jilt jinx jive jobs jock jogs john join joke jolt
    jots jowl joys judo jugs jump junk jury just jute keel keen keep kegs kelp kept kern keys kick kids kiln
    kilo kilt kind king kink kiss kite kits kiwi knee knew knit knob knot know koan labs lace lack lacy lads
    lady lags laid lain lair lake lamb lame lamp land lane laps lard lark lash lass last late lath laud lava
    lawn laws lays laze lazy lead leaf leak lean leap left legs lend lens lent less lest lets levy liar lice
    lick lids lied lien lies lieu life lift like limb lime limp line link lint lion lips lisp list live load
    loaf loam loan lobe lobs loci lock lode loft logo logs loin loll lone long look loom loon loop loot lope
    lord lore lose loss lost lots loud lout love lows luck lugs lull lump lung lure lurk lush lute lynx lyre
    mace made maid mail maim main make male mall malt mama mane many maps mare mark mars mash mask mass mast
    mate math mats maul maze mead meal mean meat meek meet meld melt memo mend menu meow mere mesa mesh mess
    mica mice midi mild mile milk mill mime mind mine mini mink mint mire miss mist mite mitt moan moat mobs
    mock mode mold mole molt monk mood moon moor moos moot mope more morn moss most moth move mown much muck
    muff mugs mule mull mums mush musk must mute mutt myth nabs nags nail name nape naps nave navy near neat
    neck need neon nerd nest nets news newt next nibs nice nick nigh nine nips node nods noel none nook noon
    norm nose nosy note noun nova nude nuke null numb nuns oaks oars oath oats obey oboe odds odes odor ogle
    ogre oils oily oink okay okra olds olive omen omit once ones only onto onus onyx ooze opal open opts opus
    oral orbs orca ores ouch ours oust outs oval oven over owed owes owls owns oxen pace pack pact pads page
    paid pail pain pair pale pall palm pane pang pans pant papa para pare park part pass past pate path pats
    pave pawn paws pays peak peal pear peas peat peck peek peel peep peer pegs pelt pens pent peon perk pest
    pets pews pick pier pies pigs pike pile pill pine ping pink pins pint pipe pits pity plan play plea pled
    plod plop plot plow ploy plug plum plus pods poem poet poke pole poll polo pomp pond pony pooh pool poor
    pope pops pore pork port pose posh post posy pots pour pout pram pray prey prim prod prom prop pros prow
    pubs puck puff pugs pull pulp puma pump punk puns punt pupa pups pure purr push puts putt pyre quad quay
    quid quip quit quiz race rack racy raft rage rags raid rail rain rake ramp rams rang rank rant rape rapt
    rare rash rasp rate rats rave rays raze read real ream reap rear redo reed reef reek reel refs rein rely
    rend rent rest ribs rice rich ride rife riff rift rigs rile rill rims rind ring rink riot ripe rise risk
    rite road roam roan roar robe robs rock rode rods roes roil role roll romp roof rook room root rope rose
    rosy rote rots rout rove rows rubs ruby rude rue ruff rugs ruin rule rump rung runs runt ruse rush rust
    ruts sack safe saga sage sags said sail sake sale salt same sand sane sang sank saps sari sash sass save
    sawn saws says scab scam scan scar scat seal seam sear seas seat sect seed seek seem seen seep seer sees
    self sell semi send sent sets sewn sews shag sham shed shin ship shoe shop shot show shun shut sick side
    sift sigh sign silk sill silo silt sine sing sink sips sire site sits size skew skid skim skin skip skis
    slab slag slam slap slat slaw slay sled slew slid slim slip slit slob sloe slog slop slot slow slug slum
    slur smog smug snag snap snip snob snow snub snug soak soap soar sobs sock soda sofa soft soil sold sole
    solo some song sons soon soot sore sort soul soup sour sown sows soya span spar spas spat sped spew spin
    spit spot spry spud spun spur stab stag star stay stem step stew stir stop stow stub stud stun subs such
    suds sued sues suit sulk sumo sump sums sung sunk suns sure surf swab swam swan swap swat sway swig swim
    swum sync tabs tack taco tact tags tail take tale talk tall tame tamp tang tank tape taps tarp tart task
    taut taxi teak teal team tear teas teem teen tell tend tens tent term tern test text than that thaw thee
    them then they thin this thud thug thus tick tide tidy tied tier ties tiff tile till tilt time tine tins
    tint tiny tips tire toad toed toes tofu toga togs toil told toll tomb tone tong tons took tool toot tops
    tore torn tort toss tote tots tour tout town tows toys tram trap tray tree trek trim trio trip trod trot
    troy true tuba tube tubs tuck tuft tugs tuna tune turf turn tusk tutu twig twin twit typo tyre ugly ulna
    undo unit unto upon urea urge urns used user uses vain vale vamp vane vans vase vast veal veer veil vein
    vend vent verb very vest veto vets vial vibe vice vied vies view vile vine visa vise void vole volt vote
    vows wade wadi waft wage waif wail wait wake walk wall wand wane want ward ware warm warn warp wars wart
    wary wash wasp watt wave wavy waxy ways weak wean wear webs weds weed week weep weft weld well welt went
    wept were west wets wham what when whet whey whim whip whir whit whiz whoa whom wick wide wife wigs wild
    will wilt wily wimp wind wine wing wink wins wipe wire wiry wise wish wisp with wits woes woke wolf womb
    wont wood wool word wore work worm worn wove wrap wren writ yack yank yard yarn yawn yeah year yell yelp
    yoga yoke yolk your yowl yuck yule zeal zebu zero zest zinc zips zone zoom
  `),
  6: split(`
    absurd accept access acorns across action active actual adjust admire advice affair afford afraid agency
    agreed almost always amount animal annual answer anyone anyway appeal appear around arrive artist aspect
    assist assume attach attack attend august author autumn avenue aware awhile backup ballad ballet bamboo
    banner barrel basket batter beacon beaded beagle beaker beaten beauty beaver became become before begins
    behalf behind belong beside better beyond bigger binder birder bishop bitten bitter blazer bleach blight
    blonde blouse boiler bolder bonnet border borrow bottle bottom bought bounce bounds bowled braids branch
    brandy brave bravo breach breath breeze bridge bright broken bronze brooch brooms browse brunch bubble
    bucket budget buffet bugler bumper bundle bunker burden bureau burrow bushel butter button buyers cabins
    cactus camera camped canals candle canine canoes canopy canvas canyon carbon career carpet carrot carton
    carved casino castle casual cattle caught causes cavern cedars celery cellar cement census center cereal
    chance change chapel charge charms chasms cheese cherry chests chewed chilly chimes choice choose chorus
    chosen church cinema circle circus cities citrus claims clamps clever client cliffs climax clinic clover
    clutch coarse coated cobalt coffee collar colony colour column combat comedy comets coming commit common
    cooler copper corner cotton county couple course cousin covers coward cowboy cradle crafts cranes crater
    crayon create credit crisis critic crowds cruise crunch crusty cuckoo curfew curtsy cursed curved custom
    cymbal dagger dainty damage damper dancer danger daring darken dazzle dealer debate debris decade decide
    decode deepen defeat defend define degree delays delete delight deluxe demand denote denser dental depart
    depend deputy desert design desire detail detect device devote dialog differ dinner dipped direct dishes
    divide docked doctor dollar domain donate donkey dotted double dragon drapes drawer dreams dredge drifts
    drinks driven driver dubbed duplex during dusted duties eagles earned easily easter eaters echoes eclair
    edible editor effect effort eighth either elapse elbows elders eleven embark emblem emerge empire employ
    enable encode encore endure energy engage engine enjoys enough ensure entire entity equals equity errand
    escape escort estate ethics evenly events evolve exceed except excess excite excuse exempt exhale exotic
    expand expect expert expire export expose extend extent extras fabric facing factor fairly falcon fallen
    family famous farmer fasten father fathom fatten faucet faulty favour feared feeder fellow female fencer
    ferret fervor fiddle fields fierce figure filled filter finale finder finest finger finish firmly fiscal
    fisher fitted fixing flabby flavor fleece flight flinch floats floral flower fluent flurry flying follow
    forbid forest forget formal format former fossil foster fought fourth frames freely freeze french friend
    fringe frosty frozen fruits funded funnel future gadget galaxy gallon gallop garage garden garlic gather
    gazing gender gentle gently german gifted giggle ginger girder glacier glance gleams global gloomy gloves
    golden gopher gospel gossip govern graced grader graham grains grande granny grapes graphs grasps grassy
    gravel greasy greedy greens groove ground groups grouse growth guards guests guides guitar gutter habits
    hacker hailed hamlet hammer hamper handle hanger happen harbor harder hardly harvest hasten hatred hauled
    hazard header health hearty heater heaven hedges height helium helmet helper herald herbal hereby hermit
    heroic hidden higher highly hiking hinder hockey holder hollow homage honest honour hooked hoping horizon
    hornet horses hosted hotels hourly humble humour hunger hunter hurdle hurled hybrid hyphen iceberg icicle
    ignite ignore immune impact import impose impulse inches income indeed indent indoor infant inflow inform
    injure inland inmate insect inside insist instep intact intend intent invade invent invest invite island
    isolate issued itself jacket jaguar jargon jersey jigsaw jingle jockey joined jolted jostle journal joyful
    judged juggle juicer jumble jungle junior jurist justly kayaks keeper kennel kettle kidney kindly kingly
    kisses kitten kneads knight knives knobby knotty labels ladder ladies lagoon lament lancer landed lantern
    lapsed laptop larder larger lately lather latter laughs launch laurel lavish lawyer layers layout leader
    league leaped learnt leases leaves ledger legacy legend legion lender length lesson letter levels levers
    liable lichen lights likely limber limits linden linear linens liners lining linked liquid listen litter
    little lively livery living lizard loaded loafer loaned lobby locate locker lodged lofty logged logics
    looked looser losing lounge lovely loving lowest loyal lucent lumber lumpy lunar lurked luxury lychee
    macaws madden madame magnet magpie maiden mailed mainly makers making mallet mammal manage manner mantle
    manual marble margin marine marked market marrow marvel mascot masked masons master matter mature meadow
    meager meanly measle medals medium melody melted member memoir memory mended mental mentor merely merger
    merits mermaid merry method micron middle midget midway mighty mild milder mimics mindful mingle minute
    mirror misery misled missed mister mittens mixing mobile modern modest modify module moment monkey months
    mooing mopped morale morals morsel mortal mosaic mostly mother motion motive motors moving mowers muffin
    mulled mumble murals murmur muscle museum mutter mutual myrtle myself mystic napkin narrow nation native
    nature nearby nearer neatly nectar needle nephew nerves nested nettle neural neuter newest nibble nicely
    nickel nimble nipped nobody noodle normal nosily notice notion novels number numbed nurses nutmeg nuzzle
    oatmeal obeyed object oblige obtain occupy occurs oceans offend offers office offset oldest olives omelet
    onions online onward opened openly operas opiate oppose optics option orange orbits orchid ordeal orders
    organs origin ornate others ottars ounces outfit outing outlet output outset oyster packed packet padded
    paddle pagoda palace pallet palmed pandas panels panics pantry papers parade pardon parent parish parked
    parlor parody parrot parsed partly passed pastel pasted pastry patchy patent patrol patron pattern paused
    paving pebble pedals peeled pelted pencil penguin people pepper period permit person phrase picnic picked
    pieces pierce pigeon pillar pilots pinch pirate pistol pitchy placid plague planet plants plaque plaster
    plated player please pledge plenty plough plucky plunge pocket poetic points poison poking police policy
    polish polite poller ponder poodle poplar poppy popular porter portal poster potato potent pounce pounds
    powder praise prance prayer precut prefer prefix pretty prewar prices pricey prided priest primer prince
    prints prison prized probes profit prompt proofs proper propel proven prowls pruned public pucker puddle
    puffed pulley pulped pulses pumice pumped punchy pupils puppet purely purity purple pursue pushed puzzle
    quaint quakes qualms quarry quartz quaver queasy quench quests queued quiche quiets quills quilts quince
    quirks quiver quoted rabbit racing racket radial radish rafter ragged raider railed rained raisin ramble
    ramped random ranger ranked rapids rarely rascal rashly rather rating ration rattle ravens ravine reader
    really realms reason rebate reboot recall recent recess recipe reckon record recoup rectal redeem reduce
    reefed refill reflex reform refuge refund refuse regain regard regime region regret reheat reject relate
    relics relief relish remain remark remedy remind remote remove rename render renown rental repair repeal
    repeat replay report resale rescue resent reside resign resist resort rested result retail retain retire
    return reveal review revise revive reward rhythm ribbon riches riddle riders ridges rifles rigged righty
    rigors rinsed ripple rising rivals rivers riving roadie roared roasts robbed robins robust rocket rodent
    rolled romped roofed rookie roomie rooted rotate rotten rouble rouged roughs rounds router routes rowing
    rubber rubble rudder rugged ruined rulers rumble rumors runner runway rushed rustic rusted sacred sadden
    saddle safari safely safety sailor salads salary salmon saloon salute sample sandal sanity sapped sardine
    sashay satire saucer sauna savage savour sawing saying scales scalpel scampi scanty scarce scared scarfs
    scenic scheme school scorch scored scorns scotch scouts scrape scraps screen screws scribe scroll scurry
    season seated second secret sector secure sedate seeded seeing seeker seemed seldom select seller senate
    sender senior sensor sentry serene serial series sermon served server settle severe sewing shabby shadow
    shaded shaken shakes shaley shaped shapes shards shared sharks sharpen shaved shears sheets shelf shells
    shield shifts shiner shiney shinny shirts shiver shocks shoots shorts should shouts shovel shower shrank
    shriek shrimp shrine shrink shrubs shrugs shrunk sighed sights signal signed silent silica silken silver
    simple simply sinews singer single siphon sister sitter sizing skated skater sketch skewed skiers skiing
    skills skinny skirts skulls slacks slalom slated sledge sleeve sleigh slices slider slight slimmer slopes
    sloppy slouch sliver smalls smarts smiled smiles smoked smoker smooth snacks snails snakes snappy sneaks
    sneeze sniffs sniper snored snorts snowed snowman soaked soared sobbed social socket sodium soften softly
    soiled solace solely solemn solids soloist solved sombre sonata sonnet soothe sorrow sorted sought sounds
    source soviet spaces spade sparks sparse spatula speaks spears speech speedy sphere spiced spices spider
    spiked spills spinal spined spiral spirit spital splash splice spoils spoken sponge spools spoons sports
    spouts sprain sprang sprawl sprays spread spring sprint sprout spruce spying square squash squawk squeak
    squeal squint squire squirm stable stacks stadium staffs staged stains stairs stakes stalks stalls stamps
    stance stands staple starch starry starts starve stated states static statue status staves stayed steady
    steaks steals steams steels steeps steers stella stems stench stereo sticks stiffs stifle stigma stilts
    stinks stitch stocks stoked stolen stones stools stoops storms stormy stoves strain strait strand straps
    straws streak stream street stress strewn strict stride strife strike string stripe strive strode stroke
    stroll strong struck strung studio studies stuffy stumps stupid sturdy stylish subdue sublet submit subtle
    suburb subway sudden suffer sugars suited sullen summer summit summon sunken sunlit sunset supper supply
    surely surface surfer surged survey swamps swarms sweats sweeps sweets swells swerve swings switch swivel
    swords symbol syntax system tablet tackle tactic tailor taking talent talked tamper tandem tangle tanned
    target tariff tassel tasted tatter taught taunts tavern teapot teased teaser teeter temper temple tenant
    tender tennis tenure ternary terror thanks thatch thawed theirs theme theory thesis thicket things thinks
    thirds thirst thorns though thread threat thrice thrift thrill thrive throat throne throng thrown thrust
    thwart ticket tickle tidied tiered tigers timber timely timers tinder tingle tinker tinsel tiptoe tirade
    tiring tissue titled toasts toddle toffee toggle toiled tokens tolled tomato tongue tonics tonight toolkit
    tooths topics topple torch torrid tossed tossup totals toucan touchy toupee toured towels towers toxins
    traced tracks tragic trails trains traits tramps trance transit trauma travel treads treaty treble tremor
    trench trends triads tribal tribes tricks trifle trimly triple triumph trophy tropic trough trowel truant
    truce trucks trudge truest truism trusts truths trying tucked tufted tumble tundra tunnel turban turbot
    turkey turmoil turned turnip turtle tusked tussle tutors tweaks tweeds twelve twenty twined twists twitch
    typing tyrant udders ulcers ultima umpire unable unbend uncles uncoil uncork uncurl undone unease uneven
    unfair unfold unfurl unhurt unific unions unique united unlace unlike unload unlock unpack unpaid unreal
    unrest unroll unruly unsafe unsaid unseal unseen untidy untold unused unveil unwell unwind unwrap upbeat
    update upheld uphill uphold upkeep upland uplift upload uproar uproot upsets upside upward urgent usable
    useful ushers usual utmost utopia utters vacant vacuum valets valiant valley valour valued valves vandal
    vanish vanity vapour varied vassal vaults vector veggie veiled velvet vendor veneer venues verbal verged
    verify versus vessel vested vetoed viable vibrant vicar victim videos viewer vigour viking vinyls violet
    violin vipers virtue vision visits visual vivify vocals vodkas voiced voices volley volume voodoo voters
    voting vowels voyage waddle wading wafers waffle wagers wagons waited waiter waiver walked walker wallet
    walnut walrus wander waning wanted warden warmer warmly warned warped washed washer wasted watchful waters
    watery waving weaken weakly wealth weapon weaved wedged wedges weekly weighs weight weight weird welded
    welfare wetted whaler wharfs wheels whence whined whisky whites wholly wicked widely widest widget wields
    wiggle wilder wildly willow wilted wimple window winery wingers winner winter wiring wisdom wisely wishes
    wither within without wizard wobble woeful wolves wonder wooded wooden woodsy woolen worded worker worthy
    wounds wracks wrangle wrapup wreath wrecks wrench wretch wright wrings wrists writer writes yachts yammer
    yanked yawned yearly yearns yeasty yellow yelped yields yogurt yonder youths zealot zephyr zigzag zinnia
    zipper zither zodiac zombie zounds
  `),
  7: split(`
    abandon ability absence academy account accused achieve acquire address advance adviser against airline
    airport alcohol alleged already amateur amazing ancient another anxiety anybody applied arrange arrival
    article assault assumed assured atlanta attempt attract auction average awkward bachelor baggage balance
    balcony bandage banking banquet bargain barrier battery bearing beating bedroom believe beneath benefit
    besides between bicycle biggest binding biology blanket blessed blossom boiling bravery breathe brigade
    brother brought buffalo builder burning cabinet caboose caffein calcium calling campers capable capital
    captain capture caravan cardigan careful carried carrier cascade cashier casters catalog cautious ceiling
    celebrate cellars central century ceramic certain chamber channel chapter charity charter chatter cheaper
    checked cheddar cheerful chemist cherish chestnut chicken chimney choices chooses chuckle cinnamon circuit
    citizen clarity classic cleaner cleared clearly clement climate climber clipper closing clothes clouded
    cluster coastal cobbler coconut collect college collide colonel colored combine comfort command comment
    commute compact company compare compass compete compile complex compose compute concept concern concert
    conduct confess confirm conflict confuse connect consent consist console consult consume contact contain
    content contest context control convert conveys cooking cooling coppery cordial correct corridor cottage
    counter country coupled courage courier covered crackle crafted cranked crashes crayons created creator
    creature credits crevice cricket crimson crisply crooked crossed crowded crucial crumble crusade crystal
    cuisine culture cunning cupcake curious current cushion custody customs cutlery cutting cyclist cylinder
    dairies damages dancing darkest darling dashing dazzled dealing decades decency decided decimal declare
    decline decoded decorum defence defiant deficit defined deflate degrees delayed delight deliver demands
    density dentist deposit descent deserve desired despair despite dessert destiny details detects develop
    devoted diagram diamond diaries dictate differs digital diluted dimples dioxide diploma dipping directs
    disable disband discard discern discuss disease dislike dismiss display dispute distant distill disturb
    diverse divided dizzily doctors dolphin donated doorway doubled drafted dragged drained dragons drapery
    drastic drawing dreamer dresser drifted drilled drinker dripped driving drizzle dropped drought drummer
    duchess dungeon durable dusting dwelling dynamic eagerly earlier earners earning earthen eastern eatable
    ecology economy edition educate effects efforts eighths elderly elected element elegant elevate eleven
    embrace emerald emotion empathy emperor empires employs enabled enclose endless endorse endured enemies
    engaged engines english enhance enjoyed enlarge enlists enormous enquire ensured entered entire entitle
    entrant entries envelop episode equally equator erosion errands escaped escorts essence estates eternal
    evening everyone exactly examine example exceeds excerpt excited exclaim excited exhaust exhibit existed
    exotics expands expects expense experts expires explain explore exports exposed express extends extract
    extreme eyebrow fabrics factors factory faculty failing failure fairest falcons fallen falling fantasy
    farmers farther fashion fastest fathers fatigue feather feature federal feeding feeling fellows felting
    fencing ferment festive fiction fiddler fielder fifteen fifties figured filling filmier filters finally
    finance finding fingers finland finishes firstly fishery fitting fixture flagged flaming flannel flashes
    flatten flavors flecked fleeing fleeted flicker flights flipped floated flooded flowers flowing fluency
    flushed fluster flutter focused folders folding foliage follows fondest footage footing forbade forearm
    foreign foremost forests forever forfeit forgave forgive forgets forgot formats formula fortune forward
    fossils fountain foxhole fracture fragile fragment frantic freckle freedom freezer freight frequent fretted
    friends frigate fringes frosted frosty fulfill funeral funnels furnace further gadgets gallery galleon
    gallons gambled gardens garland garment garnish gateway gathers general genesis genuine geology gesture
    getting giggled gingham giraffe glacier gladden glamour glanced glimpse glisten glitter gloomy glorify
    glowing gnarled goddess goggles golfing goodbye gorilla gospels gourmet grabbed gracious gradual grammar
    grandad granite granted graphic grateful gravity grazing greater greeted griddle grilled grimace grinder
    gripped grizzly grocery grooved grouped growing grumble guarded guesses guidance guitars gumdrop gusting
    habitat hallway hamlets hamster handful handled handles hangars hanging happens hardest hardier harmony
    harness harvest hastily hatched haunted hazards headers heading healthy hearing hearten heavens heavier
    hectare heights helpers helpful herbage herding heritage heroine herring hexagon hiccups hidden highest
    highway hilltop himself hinting hitched hobbies hoisted holdall holiday hollows homages honesty honored
    hopeful horizon hormone hornets horrify hospital hostile hotcake hottest housing however hugging humming
    hundred hunters hunting hurdles hurling hurried husband hustled hydrant hygiene iceberg icicles ideally
    illness imagine imitate immense immerse impacts imperil implied imports impress imprint improve impulse
    inboard incense incline include incomes indexed indoors induced indulge infancy infants inferno inflate
    inflict informal inhabit inherit initial injured inkwell inkling inquire inroads insects inserts insider
    insight insists inspect inspire install instant instead insulin insured intends intense interim interior
    intrude invader invalid invents inverse invited invoice involve inwards islands isolate issuing jacuzzi
    jailers janitor jarring jasmine jealous jelling jerking jetties jeweler jewelry jingles jogging joiners
    jointed jostled journal journey joyride jubilee judging jukebox jumbled jumpers juniors justice justify
    karaoke kayaker keenest keeping kennels kerosene kestrel kettles keyhole kicking kidneys killing kilobyte
    kindest kindled kingdom kinship kitchen kittens kneaded kneeled knights knitted knocked knotted knowing
    labeled labored laborer lacking ladders lagging lagoons lakeside lamppost lantern lapping largely lasting
    latched latency lateral lattice laughed laundry lavatory lawsuit layered layouts leading leaflet leagues
    leaning learned learner leashed leather leaving lecture leftist legally legends leggings legible leisure
    lending lengths lenient lentils leopard lessons letdown letters liaison liberal liberty library license
    lifting lighter lighten lightly limited lincoln lineage linguist linkage lintels lioness liquids listens
    listing literal littler livable loading loaning lobster located locater lockers lodging logical longest
    longing lookout looming loosely lottery loudest lounger lovable loyalty lozenge luckily luggage lullaby
    lumbers luminous lumping lurched lurking lustrous luxury lyrical machine madness magenta magical magnets
    magnify mailbox mailing mainland mansion mantled manuals manured mapping marbled marched margins mariner
    markers marking marmalade marquee married marshal martial martini marvels mascots mashing massage massive
    mastery matched matinee matters mattress maximum meadows meaning measles measure medical medium meeting
    melodic melting memento memoirs mending mention mercury mermaid message metallic meteors methods midterm
    midwest mileage militia millions mingled minimal mingles minimum mining minnows minster minstrel minutes
    miracle mirrors miseries missile missing mission mistake mistook mixture mobiles mockery modeled modesty
    modular moisten molding moments monarch mondays monitor monkeys monster monthly morning mortals mortgage
    mosaics mothers motions motives motored mottled mounted mountain mourned mousses mowings mustard muffins
    muscles museums musical mustang mustard mutters mystery mystify napkins narrate narrows nations natural
    naughty nautical nearest nearing neatest nebulae necklace nectars needles negated neglect neither nervous
    nesting netting network neutral newborn newness nickels nicking nightly nineties nitrogen nobles nodding
    nominal nominee nonstop noodles noontime normals nostril notable notably notched nothing noticed notions
    nourish novella nowhere nuclear nuggets numbers numeral nunnery nursery nurture nutmegs nutrient oatmeal
    obelisk objects oblique obscure observe obvious occupant occupied oceanic octagon october oddness offence
    offered officer offices offsets oilskin ointment olympic omitted onboard oneself ongoing onshore onwards
    opaline openers opening operate opinion opposed optical optimum options oracles oranges orbital orchard
    ordered orderly ordinary organic origins ornament orphans oscars ostrich otherwise ottoman outback outcome
    outcrop outdoor outfits outings outlast outlets outline outlook outpost outputs outrage outside outward
    ovation overall overlap overlay overrun oversee overdue oxidize oysters pacific package padding paddles
    padlock pageant painful painted painter paintings palaces pallets palmist pampers panache pancake panelled
    panicky panther papered paprika papyrus parable paraded paradox paralysis parasol parcels pardons parents
    parings parkway parsley parsnip partial parties partner passage passing passion pastels pastime pastors
    pastry pasture patched patents pathway patient patriot patrols pattern paupers pavement pavilion paycheck
    payment payouts peaches peacock peanuts pebbles peculiar pedaled peddler pedigree peeking peelers peeling
    pelican penalty penance pencils pendant penguin pennant pension peonies peppers percent perched perfect
    perform perfume perhaps periods perjury permits persist persona pertain pervade pestles petrels petting
    pharaoh pharmacy phoenix phonics phrases physics pianist pickles picnics picture piebald pierced pigment
    pigtail pilgrim pillars pillows pilotage pinball pinched pinnacle pioneer pipeline piquant piracy pitched
    pitcher pivotal placard placing plainly planets planked planner plantain planted plaster plastic plateau
    platoon platter playful playing pleaded pleased pleases pleated pledges plenary plentiful plotted ploughs
    plucked plumage plumber plummet plunder plunged plurals plywood pockets podcast podiums poetics poetry
    pointed pointer poisons polaris polemic policed polished politic pollard pollens polling pompous ponchos
    pondered pontoon popcorn popular porches porters portion portray possess posture potatoes potency pottery
    poultry pounced pounded poverty powdery powered praised prances pranced prancer prawns prayers preachy
    precede precept precise predict preface prefers prelude premier premise prepaid prepare present preside
    presses presume pretend pretext pretzel prevail prevent preview previous priced pricing primary primate
    primers princes printer prisons privacy private probing problem proceed process proclaim procure prodigy
    produce product profile profits profound program project prolong promise promote prompts pronoun proofed
    propane propels prophet propose prorate prosper protect protein protest protons proudly proverb provide
    proving provoke prowess prowler proxies pruning psalter publish puckers pudding puddles pullman pulleys
    pulsate pumpkin punched puncher punctual pungent punters puppies purcell purging puritan purpose pursued
    pursuit pushing pustule puzzled pyramid pythons quaffed quahogs quaking qualify quality quantum quarrel
    quarter quartet quashed quavers queenly queried queries quested questions quibble quicken quickly quieted
    quietly quilted quinine quintet quipped quirked quitted quivers quizzed quorums quoting rabbits raccoon
    radiant radiate radical radiant radishes raffles ragtime railing railway rainbow rainier raisins rallies
    ramblers rampart ranched ranches randoms rangers ranking ransack ransoms rapidly rapport rapture rarefy
    rascals rasping ratchet rations rattler ravaged reached reacted readers reading readily realism realist
    reality realize rebuild rebuilt recalls receipt receive recipes recital reciter reckons reclaim recline
    recluse recoils recover recruit rectify recycle redeems reduced reduces redwood reefing reeling refined
    refinery reflect reforms refrain refresh refuels refunds refusal refuted regally regards regatta regency
    regents regimen regions regrets regular rehears rehouse reigned reindeer rejects rejoice related relaxed
    relayed release reliant relieve religion relined relists remains remakes remarks remnant remodel remorse
    remoter removal removed renamed renders renewal renewed renters reopens repairs repeals repeats repents
    replace replays replete replica reports reposed reprint reproof reptile repulse request require rescued
    rescuer reserve resides residue resists resolve resorts resound respect respond restful restore restrain
    results resumed retails retains retells retired retiree retract retreat returns reunion reunite reveals
    revenge revenue reverie reverse reviews revised revival revived revolts revolve rewards rewound rhubarb
    rhyming ribbons riddles ridings riflery rigging righted rigidly rimming ringers ringlet rinsing riotous
    ripened riposte rippled riptide risking rituals rivalry riveted roadmap roadway roaming roasted robbery
    robotic rockets rocking rodents rollers rolling romance romantic roofing rookery roomier roosted rooster
    rootlet rosette rosebud rotated rotates rotunda roughen roughly rounded rounder roundup rousing routine
    rowboat rowdier royalty rubbing rubbish rubbles rucksack rudders ruffled ruffles rugged ruining rulings
    rumbles rummage rumours runaway rundown runners running runways rupture rurally rushing russets rustics
    rusting ruthless sabbath sabotage sacking saddens saddled sadness safeguard saffron sagging sailing sailors
    salad salient salmon saloons salting saluted salvage samples sampler sanctum sandals sandbar sanding
    sandpit sapling sapphire sarcasm sardine satchel satires satisfy saucers savages savings savored sawdust
    sayings scalded scallop scalpel scamper scandal scanned scanner scarcer scarlet scatter scenery scented
    sceptic schemes scholar schools science scissor scolded scooped scooter scorned scoring scotland scourge
    scouted scrape scraped scraper scratch scrawls screens screwed scribes scripts scrolls scrubby scruple
    scuffle sculpted sculpts scurvy seabird seabed seacoast seaboard sealant sealing seaside seasons seating
    seaweed secrecy secrets section secular secured sediment seeding seedling seekers seeking seeping segment
    seizing seldom selects selfish sellers selling seminar senates senator sending sensors sensory sentry
    sentence sequel sequence serials seriate serious sermons serpent servant servers service serving session
    setback setting settled settler seventh several severed sewage shabby shackle shading shadows shafted
    shakeup shaking shallow shamble shampoo shandy shanked shaping sharing sharpen sharper shatter shaving
    shearer sheaths shedded sheepish sheeted shelled shelter shelved shepherd sheriff shields shifted shilling
    shimmer shingle shining shinier shipped shipper shirked shirked shivers shocked shoeing shooter shooting
    shopper shoring shorten shortly shotgun shouted shoving showers showing showman shreds shrewd shrieks
    shrimps shrined shrinks shrivel shudder shuffle shunned shunted shutter shuttle shyness sibling sickens
    sickle sideway sidings sighing sighted signals signify signing silence silicon silkier sillier siltier
    silvery similar simmers simpler simplex sincere singers singing singled singular sinkage sinking sinuous
    siphons sirloin sisters sitters sitting situate sixteen sixties sizable sizzled skaters skating skeptic
    sketchy skewers skilled skillet skimmed skimmer skinned skipped skipper skirted skydive skylark skyline
    slacken slacker slanted slashed slashes slated slatted slavery sleeker sleeper sleeves sleighs slender
    slicing slicker slide slimmer slinged slipped slipper slither sliver slogans slopped slotted slouchy
    slowdown slowest slugger sluices slumber slumped smacked smaller smarter smashed smashes smearing smelled
    smelter smiling smitten smocked smokers smoking smolder smoothly smother smudged snagged snapper snarled
    snatchy sneaked sneaker sneezed sniffle snifter snipped snippet snorkel snorted snowman snowmen snuffle
    snugly soaking soapbox soaring sobbing society socking sockets softens softest softies software soilage
    sojourn solaced soldier solicit solidly soloist soluble solvent solving somehow someone someday sonatas
    songful sonnets soothed soothes sorcery sordid soreness sorghum sorrows sorting sounded soundly soupcon
    sources souring souvenir soviets spacial spacing spangle spaniel spanned spanner sparing sparkle sparrow
    spatial spatter spawned speaker special species specify specks spectra speech speeder speedup spelled
    speller spelunk spender spewing sphere spheres spicier spiders spigots spiking spilled spindle spinner
    spinney spirals spirits spiting splashy spliced splints splurge spoiled spoiler sponges sponsor spoofed
    spooled spoonful sporadic sporran sporty spotted spotter spouses spouted sprains sprawls sprayed spreads
    sprigged springs sprints spritely sprouts spruces spryest spumous spurned spurted sputter spyware squalid
    squalls squared squares squashy squatty squeaks squeaky squeals squeeze squelch squinty squired squirms
    squirts stabbed stabled stacked stadium staffed staging stained staking stalked stalker stalled stamina
    stamped stamper stanched standby standee standing stanzas stapler starchy stardom staring starlet starred
    started starter startle starved stashed stately statics stating station statues stature statute staunch
    staving staying steaded steadily stealth steamed steamer steeped steeper steeple steered steerer stellar
    stemmed stencil stepped stereos sterile sternly sticker sticky stiffen stiffer stifled stigmas stilled
    stilted stimuli stinger stinted stipend stirred stirrer stirrup stitched stocked stocker stodgy stoical
    stokers stolen stomach stomped stoners stonier stooped stopgap stopped stopper storage storing stormed
    stouter stovers stowage straggle straight strains straits strands strange straps strata stratum strawed
    strayed streaks streaky streams street stretch strewed stricken strides strikes striker strings stringy
    striped stripes stripped strived strobes strokes strolls strongly strophe strudel strunted stubble
    stubborn stubbed studded student studied studios stuffed stumble stumped stunned stunner stunted stupefy
    sturdily stutter stylish stylize subdued subject sublime submits suburbs subside subsidy subsist subtler
    subtype suburbia success succeed succumb suckled suction suffice suffuse sugared suggest suicide suiting
    suitors sulfate sullied sultans summary summers summits summons sunbeam sunburn sundial sundown sunlamp
    sunless sunrise sunsets sunspot suntans superb support suppose supreme surface surfers surgeon surgery
    surging surmise surname surpass surplus surreal surveys survive suspect suspend sustain swaddle swagger
    swallow swamped swanked swapped swarmed swathed swaying swearer sweater sweeper sweeten sweeter swelled
    swelter swerved swifter swiftly swigged swilled swimmer swindle swinger swinish swiping swirled swishes
    switch swollen swooned swooped swopped swordsman sworded symbols symptom synapse syndrome synergy syntax
    syringe systems tabasco tabbing tableau tablets tabling tabloid tacking tackled tactful tactics tadpole
    taffeta tagging tailors tainted takeoff takeout talents talkers talking tallest tallied tallow tampers
    tandems tangent tangled tankard tankers tanking tanners tanning tantrum tapered tapings tapioca tappers
    tapping tardier targets tariffs tarnish tarried tartans tasking tassels tasters tasteful tasting tatters
    tattler tattoos taunted tautens taverns tawnier taxable taxpayer teacher teaches teacups teamed teaming
    teapots tearful teargas tearing teasers teasing teatime teaware technic tedious teeming teenage teenier
    teepees teetered telecom telexes telling tellers tempera tempers tempest templar temples tempted tenable
    tenancy tenants tendons tenfold tenners tensely tensile tension tensors tentacle tenting tenuous tenured
    tequila termini termite terrace terrain terrier terrify tersely testing testify textile textual texture
    thalami thanked thatched thawing theatre thematic theorem theorist therapy thereby therein thereof thermal
    thermos thesaurus thicken thicker thicket thickly thieves thimble thinker thinned thinner thirsty
    thirteen thirties thistle thorium thorns thought thrifty thrills thrived thriven throats throbbed thrones
    throngs through thrower thrusts thudded thumbed thumped thunder thwarts thyroid tickets tickled tidally
    tidings tidiest tiering tighten tighter tightly tigress tilling tilting timbers timbres timeout timings
    timider tinfoil tingled tinkers tinkled tinning tinsmith tinting tiptoed tirades tireder tiredly tissues
    titanic tithing titling titters toadies toasted toaster tobacco toddler toecaps toenail toffees toggled
    toiling toilets tokened tolerant tollway tomato tomboys tombs tonally tonight tonnage toolbox toolkit
    toppled topsoil torched torment tornado torpedo torrent torsion tortoise tossing totaled totally totters
    toucans touched touches toughen toughly touring tourism tourist tousled towards toweled towered township
    toxical traced tracers tracing tracked tracker tractor trading traffic tragedy trailed trailer trained
    trainee trainer traipse traitor tramped trample trances tranche transit transom trapeze trapped trapper
    travels travois trawler treacle treadle treason treated treater treble trebled treetop trekked trellis
    tremble tremors trenchant trended trendier triable triadic trialed triangle tribune tribute trickle
    tricked trickle tricky trident trifled trigger trilled trilogy trimmed trimmer trinity trinket triplet
    tripods tripped tripper trisect tritely triumph trivets trodden trolley trombone trooped trooper trophic
    tropics trouble troughs trounce trouser trowels truancy truants trucked trucker trudged trueing truffle
    trumpet trundle trunked trussed trusted trustee truthful trysted tsunami tubbing tubular tuckers tufting
    tugboat tuition tumbled tumbler tumults tunable tundras tuneful tunnels turbans turbine turbots turfing
    turkeys turmoil turners turning turnips turnkey turnoff turnout turrets turtles tussled tutored tuxedos
    tweaked tweeted tweezer twelfth twiddle twigged twinged twinkle twirled twisted twister twitchy twofold
    typhoon typical typists tyranny udderly ukelele ulcered ultimate umbrage umbrella umpired unaided unarmed
    unasked unaware unbated unbends unblock unbound unboxed unbrace unbroke unburnt uncanny uncased unchain
    uncheck unclasp uncled unclean unclear uncoils uncover uncured uncurls undated underdo undergo underlie
    undoing undress unearth uneaten unequal unfaded unfazed unfixed unfolds unforced unfunny unglued ungodly
    unhandy unhappy unheard unhinge unhitch unicorn uniform unified unifies unitary uniting unitize unknown
    unlaced unladen unlatch unleash unlined unlisted unloads unlocks unloved unlucky unmaker unmanly unmarked
    unmask unmoved unnamed unnerve unpaved unpiled unplugs unquiet unravel unready unreeled unrests unrobes
    unrolls unroofs unruled unsaddle unsafer unscrew unseals unseat unsewed unshod unsight unsized unsnaps
    unsnarl unsolved unspent unspoilt unstable unsteady unstick unstuck untamed untaxed untidier untiring
    untitled untoward untruly untruth untwist unusual unveils unvoiced unwanted unwarily unwashed unweave
    unwinds unwitty unwound unwoven unwraps upbeats upbraid upcoming updated updates upended upfront upgrade
    upheave upholds uplands uplifts uploads upmarket uppermost uprated uprated uprises upriver uproars
    uproots upscale upsetting upshots upsides upstage upstart upstate upsurge upswept uptight uptrend upturns
    upwards uranium urbanly urchins urgency urgings urinate useable usefully usherette usually usurped utensil
    uterine utilise utility utilize utmosts utopias uttered uttering vacancy vacated vacates vaccine vacuums
    vagrant vaguely vaguest vainest valance valence valiant validly valleys valours valuate valuers valuing
    valving vamping vampire vandals vanilla vanish vanquish vantage vapours variant variety various varnish
    varying vascular vaulted vaulter vaunted vectors veering vegetate vehicle veiling veinier velocity velvets
    vending vendors veneers vengeful venison ventral venture veranda verbose verdant verdict verging verified
    verifies veritable vermouth vernacular versatile version vertigo vespers vessels vestige vesting veteran
    vetoing vexedly viaduct vibrant vibrate vicious victims victors victory videoed viewers viewing vigilant
    vignette vigorous vikings village villain vinegar vintage violate violent violets violins viragos virtual
    virtues viruses visaged visceral viscous visible visibly visions visited visitor visored vistaed visuals
    vitality vitamin vitrify vivider vividly vixens vocable vocally vocals vocation voicing voiding volatile
    volcano volleys voltage volumes voluble vomited voodoos voracity votable voters voting vouched voucher
    vowelled voyaged voyager voyages vulgar vultures waddled wadding waffled wafting wagered wagging waggish
    wagoner wailing waisted waiters waiting waivers wakeful wakened walkers walking walkout walkway wallets
    walling wallops wallows walnuts walruses waltzed wanders wangles wanting wantons wardens wardrobe warfare
    warheads wariest warlike warlock warmers warmest warming warmths warning warpath warping warrant warring
    warrior warship wartime washers washing washout washtub waspish wassail wastage wasters wasting watched
    watcher watches watered waterfall watering wattage wattles wavered waveson wavelet waviest wawling waxiest
    waxwing wayfarer waylaid wayside weakens weakest weakish wealthy weaning wearers wearied wearily wearing
    weasels weather weavers weaving webbing webcast webpage webs website wedding wedging weeding weekday
    weekend weepers weeping weevils weighed weights weighty welcome welders welding welfare welkins wellies
    welters wenches wending western wetland wetness wetting whacked whalers whaling wharves whatnot wheaten
    wheedle wheeled wheeler wheezes whelped whereas whereby wherein whereof whetted whether whiffle whiling
    whimper whimsey whining whinier whipped whipper whirled whirred whisked whisker whiskey whisper whistle
    whitely whitens whitest whither whittle whizzed whizzes whoever wholely whomever whoopee whooped whopper
    whorled wickers wickets widened widener wideout widgets widowed widower wielded wielder wifely wiggled
    wiggler wigwams wildcat wilders wildest wildish willful willing willows wilting wimpled wincing windbag
    windier winding windlass windmill windows windpipe winding wineries wingers wingman wingspan winking
    winners winning winnows winsome wintery wiphats wipeout wirings wiriest wisdoms wiseacre wisely wishful
    wishing wispier wistful witched witches withers withdraw within without witness witting wittier wizards
    wobbled wobbler woeful wolfish wolfram womanly wombats wonders wondrous woodbine woodcut wooded wooden
    woodier woodman woodsman woofers woolens woolier woozier wordage wordier wording workbook workday workers
    working workman workout workshop worldly wormier worried worrier worries worsens worship worsted worthier
    wounded wracked wrangle wrapped wrapper wrathful wreaked wreaths wrecked wrecker wrested wrestle wrigged
    wriggle wringer wrinkle wristed writers writhed writhes writing written wronged wrongly wrought wryness
    yachted yachter yammers yanking yapping yardage yardarm yarding yawning yearned yearns yeasted yeasty
    yelling yelping yeoman yielded yielder yipping yodeled yodeler yoghurt yoked yolked yonder younger
    youngest youngish yourself youthful yowling yummier zealots zealous zebraic zenithal zephyrs zeppelin
    zestful zigzags zincked zingers zipcode zippers zipping zithers zodiacs zombies zoology zooming zucchini
  `),
};

/** A Connections puzzle picks four of these and takes four words from each. */
export const GROUPS: readonly { theme: string; hint: string; words: readonly string[] }[] = [
  { theme: "Things in the lake", hint: "Found in the lake", words: ["trout", "canoe", "reeds", "otter", "ripple", "pike"] },
  { theme: "Mountain weather", hint: "Mountain weather", words: ["sleet", "frost", "gale", "haze", "thaw", "squall"] },
  { theme: "Trees of the valley", hint: "Valley tree", words: ["spruce", "cedar", "birch", "aspen", "willow", "larch"] },
  { theme: "Beaver business", hint: "A beaver's business", words: ["dam", "lodge", "gnaw", "paddle", "pond", "timber"] },
  { theme: "Found in a toolbox", hint: "Toolbox item", words: ["wrench", "pliers", "hammer", "chisel", "drill", "clamp"] },
  { theme: "Kinds of bread", hint: "Kind of bread", words: ["rye", "loaf", "bagel", "scone", "brioche", "pita"] },
  { theme: "___ fall", hint: "Goes before FALL", words: ["water", "night", "wind", "snow", "foot", "rain"] },
  { theme: "___ light", hint: "Goes before LIGHT", words: ["moon", "lamp", "sun", "star", "flash", "day"] },
  { theme: "Camp ___", hint: "Follows CAMP", words: ["fire", "site", "ground", "stove", "bed", "craft"] },
  { theme: "Snow ___", hint: "Follows SNOW", words: ["flake", "shoe", "storm", "drift", "ball", "plough"] },
  { theme: "Birds you might spot", hint: "Bird you might spot", words: ["raven", "finch", "heron", "grouse", "magpie", "osprey"] },
  { theme: "Ways to move on water", hint: "Way to move on water", words: ["paddle", "row", "sail", "drift", "swim", "wade"] },
  { theme: "Musical instruments", hint: "Musical instrument", words: ["banjo", "fiddle", "flute", "drum", "piano", "harp"] },
  { theme: "Hot drinks", hint: "Hot drink", words: ["cocoa", "tea", "coffee", "cider", "broth", "chai"] },
  { theme: "Rock and stone", hint: "Kind of rock", words: ["slate", "granite", "shale", "quartz", "flint", "basalt"] },
  { theme: "Parts of a cabin", hint: "Part of a cabin", words: ["porch", "rafter", "hearth", "eaves", "shutter", "beam"] },
  { theme: "Berries", hint: "Berry", words: ["cherry", "sloe", "elder", "rowan", "bramble", "juniper"] },
  { theme: "Shades of green", hint: "Shade of green", words: ["moss", "olive", "jade", "fern", "pine", "sage"] },
  { theme: "Units of distance", hint: "Unit of distance", words: ["mile", "metre", "league", "yard", "furlong", "chain"] },
  { theme: "Card games", hint: "Card game", words: ["rummy", "snap", "bridge", "whist", "hearts", "patience"] },
  { theme: "Things with teeth", hint: "It has teeth", words: ["comb", "saw", "zip", "gear", "rake", "key"] },
  { theme: "Things with a crown", hint: "It has a crown", words: ["tooth", "king", "tree", "hat", "road", "hill"] },
  { theme: "Bodies of water", hint: "Body of water", words: ["tarn", "creek", "fjord", "bay", "inlet", "basin"] },
  { theme: "Winter sports", hint: "Winter sport", words: ["skiing", "curling", "hockey", "luge", "skating", "sledding"] },
  { theme: "Knots", hint: "Kind of knot", words: ["bowline", "hitch", "reef", "bend", "loop", "noose"] },
  { theme: "Flowers", hint: "Meadow flower", words: ["lupine", "daisy", "aster", "poppy", "violet", "clover"] },
  { theme: "Insects", hint: "Insect", words: ["beetle", "mayfly", "hornet", "cricket", "moth", "aphid"] },
  { theme: "Kinds of soup", hint: "Kind of soup", words: ["broth", "chowder", "bisque", "consomme", "gumbo", "stew"] },
  { theme: "Things that ring", hint: "It rings", words: ["bell", "phone", "ears", "alarm", "chime", "boxing"] },
  { theme: "Fire ___", hint: "Follows FIRE", words: ["wood", "place", "works", "fly", "side", "break"] },
  { theme: "___ berry", hint: "Goes before BERRY", words: ["blue", "straw", "goose", "elder", "cran", "rasp"] },
  { theme: "Boat ___", hint: "Follows BOAT", words: ["house", "yard", "swain", "hook", "man", "load"] },
  { theme: "Baking kit", hint: "Baking kit", words: ["whisk", "sieve", "ladle", "spatula", "rolling", "mixer"] },
  { theme: "Shapes", hint: "Shape", words: ["prism", "cone", "sphere", "wedge", "helix", "torus"] },
  { theme: "Trails and paths", hint: "Way through", words: ["track", "lane", "route", "course", "way", "road"] },
  { theme: "Night sky", hint: "Seen in the night sky", words: ["comet", "nebula", "planet", "meteor", "aurora", "galaxy"] },
  { theme: "Fabric", hint: "Fabric", words: ["linen", "denim", "velvet", "tweed", "wool", "canvas"] },
  { theme: "Hats", hint: "Kind of hat", words: ["beanie", "toque", "beret", "bonnet", "fedora", "cap"] },
  { theme: "Quiet sounds", hint: "Quiet sound", words: ["hush", "murmur", "rustle", "whisper", "patter", "sigh"] },
  { theme: "Loud sounds", hint: "Loud sound", words: ["crash", "boom", "clang", "roar", "blast", "thunder"] },
  { theme: "Kinds of bridge", hint: "Kind of bridge", words: ["arch", "truss", "rope", "draw", "span", "foot"] },
  { theme: "Found in a pocket", hint: "Found in a pocket", words: ["lint", "coin", "key", "string", "ticket", "pebble"] },
  { theme: "Honey ___", hint: "Follows HONEY", words: ["comb", "bee", "moon", "dew", "pot", "suckle"] },
  { theme: "Ways to laugh", hint: "Way to laugh", words: ["giggle", "chuckle", "snicker", "cackle", "guffaw", "titter"] },
  { theme: "Mountain features", hint: "Mountain feature", words: ["ridge", "scree", "cirque", "col", "arete", "summit"] },
  { theme: "Things you fold", hint: "You fold it", words: ["map", "laundry", "paper", "dough", "chair", "arms"] },
  { theme: "Herbs", hint: "Kitchen herb", words: ["thyme", "basil", "sage", "dill", "mint", "chive"] },
  { theme: "Sleep ___", hint: "Follows SLEEP", words: ["walk", "over", "less", "head", "wear", "talk"] },
];

/**
 * Crossword clues. Only words that have a clue here can appear in a Mini Crossword, so the grid
 * generator draws from these keys rather than the full word lists.
 */
export const CLUES: Readonly<Record<string, string>> = {
  // A second batch, written to widen the pool the crossword generator can draw on: biasing the
  // search toward a small set of clued words collapsed grid variety, so the honest fix was
  // more clues rather than a cleverer bias.
  age: "Years behind you", ant: "Picnic raider", arm: "Shoulder to hand", bat: "Night flier, or a cricketer's tool",
  bin: "Rubbish holder", bow: "Archer's weapon, or a ribbon", bug: "Beetle or glitch", bus: "Public ride",
  cat: "Purring pet", cow: "Milk giver", cup: "Mug without the handle", dig: "Turn over soil",
  dog: "Loyal pet", ear: "Sound catcher", eel: "Snakelike swimmer", egg: "Nest treasure",
  end: "Finish", eye: "Seeing organ", fan: "It moves the air", fin: "Fish's steering",
  fly: "Buzz about", fun: "A good time", gem: "Precious stone", gum: "Chewy sweet",
  hat: "Head cover", hay: "Dried grass", hen: "Egg layer", hop: "Little jump",
  jar: "Jam's home", jaw: "Chin's hinge", jet: "Fast plane", jug: "Pouring vessel",
  lap: "Once round the track", leg: "You stand on it", lid: "Pot's cover", lip: "Mouth's edge",
  mud: "Riverbank mess", mug: "Cocoa holder", nut: "Squirrel's prize", oil: "Slippery stuff",
  pan: "Frying vessel", pea: "Little green sphere", pen: "Writing tool", pet: "Household companion",
  pig: "Farm oinker", pin: "Tiny fastener", pit: "Deep hole", pup: "Baby dog",
  rat: "Long-tailed rodent", rib: "Chest bone", rug: "Floor warmer", run: "Go at speed",
  sun: "Golden hour's cause", tap: "Water spout", tin: "Can metal", toy: "Plaything",
  tub: "Bath", van: "Delivery vehicle", wax: "Candle stuff", web: "Spider's work",
  // four
  ball: "Round plaything", bead: "Threaded trinket", beam: "Shaft of light, or a roof timber",
  boot: "Sturdy walking shoe", bulb: "It lights up, or it grows into a tulip", cake: "Birthday bake",
  card: "You post one", claw: "Animal's hook", coal: "Black fuel", coat: "Outer layer",
  cold: "Winter's feeling", comb: "Hair tidier", cook: "Make a meal", cord: "Thin rope",
  corn: "Cob crop", crab: "Sideways scuttler", desk: "Work surface", door: "Cabin's entrance",
  drum: "Hit instrument", dust: "Shelf fluff", fire: "Campfire's heart", flag: "It flies on the pole",
  foam: "Bubbles on the rapids", fork: "Dinner prong", frog: "Pond hopper", glow: "Soft light",
  goat: "Hill climber", hand: "Five fingers", harp: "Plucked strings", heat: "Warmth",
  hood: "Coat's head cover", horn: "Antler, or a trumpet", kite: "It flies on a string",
  knee: "Leg's hinge", lamb: "Spring arrival", lens: "Glass that focuses", milk: "Dairy drink",
  mole: "Underground digger", nail: "Hammer's target", nose: "Smeller", oven: "Baking box",
  palm: "Hand's inside, or a tropical tree", pear: "Bell-shaped fruit", plum: "Purple stone fruit",
  raft: "Floating platform", rain: "It brings out umbrellas", ring: "Finger band, or a bell's sound",
  salt: "Pepper's partner", seat: "Where you sit", shed: "Garden store", ship: "Big boat",
  shoe: "Foot cover", silk: "Smooth cloth", sock: "It goes in the boot", song: "Something to sing",
  soup: "Warm bowlful", step: "One stair", tail: "A beaver's paddle", tent: "Camper's roof",
  wall: "Cabin's side", wave: "Ripple with ambition", wood: "Forest, or what it gives",
  // five
  bench: "Plaza seat", board: "Plank, or a game's surface", brick: "Wall unit",
  bread: "Baker's loaf", broom: "Sweeping tool", brush: "Painter's tool", chain: "Linked metal",
  chair: "Seat with a back", chalk: "Blackboard stick", cloud: "Sky's drifter", clock: "Tower timekeeper",
  crown: "King's headgear", feast: "Big meal", flame: "Fire's tongue", flour: "Baking powder-white",
  fruit: "Orchard produce", glass: "Window material", grape: "Vine fruit", heart: "It beats",
  honey: "Bee's gift", horse: "Rider's mount", house: "Dwelling", knife: "Cutting tool",
  lemon: "Sour yellow fruit", light: "Lamp's gift", melon: "Big juicy fruit", money: "Coins and notes",
  mouse: "Small squeaker", music: "Something to listen to", night: "Dark hours", ocean: "Vast salt water",
  onion: "Layered bulb", paint: "Brush's load", paper: "You write on it", patch: "Mended spot",
  piano: "Keyboard instrument", pizza: "Sliced round supper", plant: "Garden grower", plate: "Dinner disc",
  queen: "Royal lady", radio: "It plays the news", shelf: "Books rest on it", skate: "Glide on ice",
  smile: "Happy face", smoke: "Chimney's output", snail: "Shelled crawler", snake: "Legless slider",
  spoon: "Soup tool", sugar: "Sweet grains", table: "You eat at it", tiger: "Striped cat",
  tooth: "Beaver's chisel", torch: "Handheld light", train: "It circles the valley", wagon: "Pulled cart",
  whale: "Ocean giant", wheel: "It turns", world: "Everywhere", youth: "Early years",
  // three letters
  ace: "Card above a king", arc: "Curve of a rainbow", ash: "What a campfire leaves", axe: "Woodcutter's tool",
  bay: "Sheltered bit of coast", bee: "Busy buzzer", bog: "Soggy ground", bud: "Flower before it opens",
  cap: "Hat without a brim", cub: "Young bear", dam: "A beaver's proudest work", den: "Animal's home",
  dew: "Morning damp on the grass", doe: "Female deer", elk: "Big antlered neighbour", elm: "Shade tree",
  fir: "Christmas tree, often", fog: "Low cloud you walk through", fox: "Russet trickster", fur: "A beaver's coat",
  hut: "Small shelter", ice: "Winter on the pond", ivy: "Climbing green", jam: "Preserve on toast",
  key: "It opens the cabin", log: "Firewood, before splitting", map: "It shows the way",
  net: "Fishing mesh", 
  oak: "Mighty tree", oar: "Rowing blade", owl: "Night watcher", paw: "Animal's foot",
  pie: "Baked treat with a crust", pot: "Cooking vessel", ram: "Male sheep", row: "Use the oars",
  sap: "It runs in the maple", sea: "Salty expanse", ski: "Snowy plank", sky: "Where the stars live",
  tan: "Shade of beige", tea: "Hot cuppa", 
  toe: "Foot's end", top: "Summit", // four letters
  acre: "Field measure", bank: "River's edge", bark: "Tree's jacket", barn: "Farm building",
  bear: "Big woodland neighbour", bell: "The town hall rings it", bend: "Curve in the river",
  bird: "Feathered flyer", boat: "It floats you across", bowl: "Soup holder", calm: "Still, like the lake at dawn",
  camp: "Set up a tent", cave: "Hollow in the rock", clay: "Potter's earth", crow: "Black-feathered caller",
  dawn: "First light", deer: "Forest grazer", dock: "Where the canoes tie up", dusk: "Last light",
  farm: "Place with fields", fern: "Shady green frond", fish: "Lake catch", 
  gate: "Fence opening", gold: "Coin's colour", hawk: "Sharp-eyed hunter",
  herb: "Kitchen leaf", hill: "Gentle rise", hive: "Bee's home", iron: "Blacksmith's metal",
  lake: "Turquoise water below the peaks", lamp: "It glows at the path's edge", leaf: "It turns gold in autumn",
  lily: "Pond flower", maze: "Puzzle of paths", mist: "Morning haze", moon: "Night's lantern",
  moss: "Soft green carpet on a log", nest: "Bird's cradle", oats: "Porridge grain", path: "Trail underfoot",
  peak: "Mountain top", pine: "Needled evergreen", pond: "Small still water", 
  reed: "Marsh grass", road: "Way into town", rock: "Boulder, smaller", roof: "Shingled cover",
  root: "Underground anchor", rope: "Climber's line", sand: "Beach grit", seed: "Start of a plant",
  slip: "Lose your footing", snow: "Winter's blanket", soil: "Garden earth", star: "Night sky speck",
  stem: "Flower's stalk", tide: "Sea's rise and fall", tree: "The forest's unit",
  twig: "Small branch", vine: "Creeping climber", wind: "It bends the grass",
  wing: "Bird's lifter", wolf: "Pack hunter", wren: "Tiny brown songbird",
  // five letters
  amber: "Fossil resin, or a traffic light", beach: "Sandy shore", berry: "Small juicy fruit",
  birch: "White-barked tree", bloom: "Come into flower", brook: "Little stream",
  cabin: "Timber home in the woods", cedar: "Fragrant softwood", cliff: "Sheer rock face",
  cocoa: "Hot chocolate", creek: "Small stream", crest: "Top of a ridge or a wave",
  eagle: "Soaring hunter", field: "Open ground", flake: "One piece of snow", flint: "Firestarter stone",
  frost: "Morning sparkle on the grass", grain: "Wood's pattern", grass: "Meadow cover",
  grove: "Small wood", heron: "Long-legged wader", lodge: "Where a beaver lives",
  maple: "Its syrup goes on pancakes", marsh: "Wetland", moose: "Biggest deer", mouth: "Where a river meets the lake",
  otter: "Playful river swimmer", perch: "Lake fish, or a bird's seat", pines: "Evergreen stand",
  plaza: "Open square in town", porch: "Covered step", raven: "Big black bird", ridge: "Line along a summit",
  river: "It runs through the valley", shore: "Water's edge", slate: "Roofing rock",
  stone: "Rock in your hand", storm: "Rough weather", trail: "Hiking route", trout: "Speckled lake fish",
  water: "What fills the lake", wheat: "Bread grain", woods: "The forest, casually",
};

/** Letters that can be the centre of a Spelling Bee hive — common enough to build words around. */
export const BEE_CENTRES = "abcdeghilmnoprstu";

// ---------------------------------------------------------------- Normalisation
//
// The lists above are long enough that a word will sometimes land in the wrong bucket. Rather
// than rely on every edit being perfect, each word is filed by the length it actually has and
// duplicates are dropped. A misfiled word then costs nothing: it simply shows up in the right
// place. Only `ANSWERS` is strict, because a puzzle built on a four-letter "five-letter word"
// is unplayable.

/** Every word the Lodge knows, keyed by length. */
export const WORDS: ReadonlyMap<number, ReadonlySet<string>> = (() => {
  const by = new Map<number, Set<string>>();
  const file = (w: string) => {
    if (!/^[a-z]{3,9}$/.test(w)) return;
    let set = by.get(w.length);
    if (!set) by.set(w.length, (set = new Set()));
    set.add(w);
  };
  for (const w of RAW_ANSWERS) file(w);
  for (const w of RAW_EXTRA) file(w);
  for (const list of Object.values(RAW_BY_LEN)) for (const w of list) file(w);
  for (const g of GROUPS) for (const w of g.words) file(w);
  for (const w of Object.keys(CLUES)) file(w);
  return by;
})();

/** Words of a given length, in a stable order (seeded puzzles depend on this not shifting). */
export function wordsOfLength(n: number): readonly string[] {
  let cached = byLength.get(n);
  if (!cached) byLength.set(n, (cached = [...(WORDS.get(n) ?? [])].sort()));
  return cached;
}
const byLength = new Map<number, string[]>();

/** Words a five-letter puzzle may be built from: curated, common, and definitely five letters. */
export const ANSWERS: readonly string[] = [...new Set(RAW_ANSWERS.filter((w) => w.length === 5))].sort();

/** True if a guess is a word the Lodge will accept. Deliberately far wider than `ANSWERS`. */
export function known(word: string): boolean {
  return WORDS.get(word.length)?.has(word) ?? false;
}

/** Crossword-ready words of a given length: the ones that have a clue written for them. */
export function cluedWords(n: number): readonly string[] {
  let cached = cluedByLength.get(n);
  if (!cached) cluedByLength.set(n, (cached = Object.keys(CLUES).filter((w) => w.length === n).sort()));
  return cached;
}
const cluedByLength = new Map<number, string[]>();

/**
 * A second source of crossword clues, free: every word in a Connections group can be clued by
 * its theme. It roughly triples the clued vocabulary, which is what keeps generated grids from
 * falling back on letter-pattern clues.
 */
export const GROUP_CLUES: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of GROUPS) for (const w of g.words) if (!CLUES[w] && !m.has(w)) m.set(w, g.hint);
  return m;
})();

/** Every word the crossword can clue properly, by length. */
export function cluableWords(n: number): readonly string[] {
  let cached = cluableByLength.get(n);
  if (!cached) {
    const set = new Set<string>();
    for (const w of Object.keys(CLUES)) if (w.length === n) set.add(w);
    for (const w of GROUP_CLUES.keys()) if (w.length === n) set.add(w);
    cluableByLength.set(n, (cached = [...set].sort()));
  }
  return cached;
}
const cluableByLength = new Map<number, string[]>();

/**
 * Words a player will recognise on sight — the hand-written lists, nothing swept in from the
 * wider accepted-guess pile. Rhyme and anagram clues point at these, because "Rhymes with
 * SOREE" is not a clue.
 */
export const COMMON: ReadonlySet<string> = (() => {
  const set = new Set<string>(ANSWERS);
  for (const n of [3, 4, 6, 7]) for (const w of RAW_BY_LEN[n] ?? []) if (/^[a-z]+$/.test(w)) set.add(w);
  for (const g of GROUPS) for (const w of g.words) set.add(w);
  for (const w of Object.keys(CLUES)) set.add(w);
  return set;
})();

/** The recognisable words of a given length, sorted. */
export function commonWords(n: number): readonly string[] {
  let cached = commonByLength.get(n);
  if (!cached) commonByLength.set(n, (cached = [...COMMON].filter((w) => w.length === n).sort()));
  return cached;
}
const commonByLength = new Map<number, string[]>();
