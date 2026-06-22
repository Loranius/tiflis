// ╔═══════════════════════════════════════════════════════════════╗
// ║  [3/13]  МЕНЮ (дані, секції, категорії, позиції)              ║
// ╚═══════════════════════════════════════════════════════════════╝

const MENU_SECTIONS = [
  { key: 'main',    label: '🍽️ Основне меню',   fixed: true,
    categories: ['Холодні закуски','Салати','Перші страви','Мангал','Основні страви','Хінкалі','Гарніри','Хлібобулочні','Десерти','До пива'] },
  { key: 'bar',     label: '🍸 Бар',             fixed: true,
    categories: ['Віскі','Горілка','Ром','Текіла','Настоянки','Коньяк та бренді','Джин','Лікери','Вермути','Пиво','Безалкогольні напої','Свіжовіджаті соки','Чай','Кава','Додатково'] },
  { key: 'wine',    label: '🍷 Винна карта',      fixed: false, categories: ['Вина по бокально','Коравін','Коравін ігристе','Шампанське','Ігристі вина','Вина України (GiGi Winery)','Білі вина (світ)','Червоні вина (світ)','Портвейни та десертні'] },
  { key: 'lunch',   label: '🥗 Комплексні обіди', fixed: true,
    categories: ['Понеділок','Вівторок','Середа','Четвер','Пятниця'] },
  { key: 'season',  label: '🌿 Сезонне меню',    fixed: false, categories: [] },
  { key: 'banquet', label: '🎉 Банкетне меню',   fixed: false, categories: [] },
  { key: 'lean',    label: '🕊️ Пісне меню',      fixed: false, categories: [] },
];

const ALLERGENS = ['Глютен','Молоко','Яйця','Горіхи','Риба','Морепродукти','Соя','Селера','Гірчиця','Кунжут','Лупин','Молюски','Діоксид сірки'];

let menuActiveSection = 'main';
let menuActiveCategory = null;

const DEFAULT_MENU_ITEMS = {
  'main::Холодні закуски': [
    { name: 'Асорті м\'ясне', emoji: '🥩', time: '10-15хв', description: 'Бастурма, буженина, печений бекон, купати' },
    { name: 'Асорті рибне', emoji: '🐟', time: '20-25хв', description: 'Вугор, слабосолена сьомга, масляна. Подається з крем-сиром, грінками та руколою' },
    { name: 'Асорті сирів з Європи', emoji: '🧀', time: '10-15хв', description: 'Пармезан, дорблю, ементаль, брі, мед. Прикрашається мигдалевими пластівцями' },
    { name: 'Асорті сирів з Грузії', emoji: '🧀', time: '10-15хв', description: 'Бринза, сулугуні звичайне, сулугуні копчене' },
    { name: 'Асорті овочів', emoji: '🥗', time: '10-15хв', description: 'Помідори, огірки, перець, зелена цибуля, кріп' },
    { name: 'Асорті фруктів', emoji: '🍇', time: '10-15хв', description: 'По сезону' },
    { name: 'Соління', emoji: '🥒', time: '10-15хв', description: 'Помідори, огірки, капуста квашена і капуста червона грузинська (маринована в буряці)' },
    { name: 'Баклажани', emoji: '🍆', time: '10-15хв', description: 'З горіховою пастою або сиром сулугуні' },
    { name: 'Закуска з сала', emoji: '🥓', time: '15-20хв', description: 'Підчеревина, перетерте з часником сало, запечений бекон, 4 грінки + зубчики часнику' },
    { name: 'Печериці / гливи мариновані', emoji: '🍄', time: '10-15хв', description: '' },
    { name: 'Пхалі', emoji: '🌿', time: '10-15хв', description: 'Намазка з перетертих горіхів, капусти, спецій, гострого перцю, петрушки і кінзи. Подається з грінками' },
    { name: 'Скумбрія маринована', emoji: '🐠', time: '15-20хв', description: 'Подається з грінками і цибулею маринованою в буряку' },
    { name: 'Рулети з прошуто та крем-сиром', emoji: '🌯', time: '', description: 'З руколою всередині' },
  ],
  'main::Салати': [
    { name: 'З телятини під базиліковим соусом', emoji: '🥗', time: '20хв', description: 'Мікс салату, томати чері, смажені шампіньони в кисло-солодкому соусі, витримана телятина під базиліковим соусом, чилі-пластівці' },
    { name: 'Цезар м\'ясний', emoji: '🥗', time: '15-20хв', description: 'Мікс салату, курка, бекон, помідори чері, перепелине яйце, соус на основі жовтків, пармезан' },
    { name: 'Салат з курячою печінкою', emoji: '🥗', time: '25-30хв', description: 'Мікс салату, куряча печінка, спаржева квасоля, перець, соус на основі французької гірчиці. Прикрашається яйцем та помідором, кунжут' },
    { name: 'Салат з руколою та бейбі моцарелою', emoji: '🥗', time: '15-20хв', description: 'Рукола, помідор чері, бейбі-моцарела, соус песто, бальзамічна карамель, фісташкова крихта' },
    { name: 'Салат домашній грузинський', emoji: '🥗', time: '15хв', description: 'Помідор, огірок, цибуля, гострий перець, горіхова паста' },
    { name: 'Тбілісурі', emoji: '🥗', time: '', description: 'Болгарський перець, помідор, огірок, цибуля, домашня олія і яблучний оцет' },
    { name: 'Грецький', emoji: '🥗', time: '', description: 'Огірок, болгарський перець, помідори, синя цибуля, сир фета, маслини, оливкова олія, італійські трави' },
    { name: 'З капусти', emoji: '🥗', time: '10-15хв', description: 'Капуста, морква, кріп, оцет' },
    { name: 'З прошуто та грушею', emoji: '🥗', time: '15-20хв', description: 'Мікс салату, груша, прошуто, апельсин, сирний соус, пармезан, фісташкова крихта' },
    { name: 'З вугрем', emoji: '🥗', time: '15-20хв', description: 'Мікс салату, помідор, огірок, авокадо, вугор копчений, синя цибуля, каперси, соус унагі, кунжут' },
    { name: 'Салат з креветками', emoji: '🥗', time: '15-20хв', description: 'Мікс салату, креветки, авокадо, каперси, апельсин, грейпфрут, цитрусовий соус, слайси пармезану' },
  ],
  'main::Перші страви': [
    { name: 'Борщ червоний', emoji: '🍲', time: '15-20хв', description: 'М\'ясо свинини, сметана, кріп' },
    { name: 'Бульйон курячий', emoji: '🍜', time: '15-20хв', description: 'Локшина, перепелине яйце, куряче м\'ясо, кріп' },
    { name: 'Бульйон з хінкалями', emoji: '🍜', time: '25-30хв', description: '6 бейбі хінкаль з м\'ясом телятини та свинини 50/50, кріп, мускатний горіх' },
    { name: 'Харчо', emoji: '🍲', time: '15-20хв', description: 'Суп з м\'ясом телятини, томатів, рисом, спеціями та перцем чилі. Посипається кінзою' },
    { name: 'Солянка', emoji: '🍲', time: '15-20хв', description: 'Ковбаски, телячий язик, курка, свинина, телятина, томати. Подається з лимоном, сметаною та маслинами' },
    { name: 'Хашлама з баранини', emoji: '🍲', time: '15-20хв', description: 'Бараняча ніжка з цибулею, болгарським перцем, томатами. Багато чорного перцю, кінза' },
  ],
  'main::Мангал': [
    { name: 'Шашлик зі свинини', emoji: '🍖', time: '25-30хв', description: 'Подається на лаваші, посипається маринованою цибулею. Мінімальна порція 200г' },
    { name: 'Шашлик з телятини (лопаточна вирізка)', emoji: '🍖', time: '25-30хв', description: 'Подається на лаваші, посипається маринованою цибулею. Мінімальна порція 200г' },
    { name: 'Шашлик з телячої вирізки (внутрішня)', emoji: '🥩', time: '25-30хв', description: 'Подається на лаваші, посипається маринованою цибулею. Мінімальна порція 200г' },
    { name: 'Шашлик з курки', emoji: '🍗', time: '25-30хв', description: 'Подається на лаваші без цибулі. Мінімальна порція 200г' },
    { name: 'Ребра під медовим соусом', emoji: '🍖', time: '25-30хв', description: 'Подаються зі шматками печених яблук, поливається кисло-солодким соусом. Мінімальна порція 200г (вага одного ребра 100-130г)' },
    { name: 'Люля кебаб з телятини', emoji: '🌯', time: '25-30хв', description: 'Порція з 2-ох люля по 100г, подаються на лаваші та з цибулею' },
    { name: 'Люля кебаб з курки', emoji: '🌯', time: '25-30хв', description: 'Порція з 2-ох люля по 100г, подаються на лаваші та з цибулею' },
    { name: 'Люля кебаб з баранини', emoji: '🌯', time: '25-30хв', description: 'Порція з 2-ох люля по 100г, подається на виноградному листі' },
    { name: 'Шашлик Сакартвело', emoji: '🍖', time: '25-30хв', description: 'Телятина завертається в рулет разом з салом, смажиться на мангалі (5 рулетиків). Подається на лаваші з салатом з помідор і цибулі та соусом Сацибелі' },
    { name: 'Челогач свинний', emoji: '🍖', time: '25-30хв', description: '300-500г. Філе свинини на кістці, подається на лаваші з цибулею і соусом ткемалі' },
    { name: 'Каре з телятини', emoji: '🥩', time: '25-30хв', description: '150-200г. Філе телятини на кістці, подається з міксом салату, томатами чері і соусом ткемалі' },
    { name: 'Овочі на мангалі', emoji: '🥦', time: '25-30хв', description: 'Кабачок, баклажан, цибуля, болгарський перець, печериці. Посипається зеленню, порційно' },
    { name: 'Лаваш з помідорами та бринзою', emoji: '🫓', time: '15-20хв', description: 'Помідори, бринза, зелень, нарізається на 6 шматочків' },
    { name: 'Короп на мангалі', emoji: '🐟', time: '25-30хв', description: '200-350г, подається з лимоном' },
    { name: 'Скумбрія на мангалі', emoji: '🐟', time: '~20хв', description: '150-220г. Філе скумбрії, подається з лимоном і міксом салату' },
    { name: 'Стейк з сьомги', emoji: '🐟', time: '25-30хв', description: '150-350г. Філе, подається з міксом салату, томатами чері і лимоном' },
    { name: 'Креветки гриль', emoji: '🦐', time: '~20хв', description: '10 креветок гриль на шпажках з томатами чері і міксом салату' },
  ],
  'main::Основні страви': [
    { name: 'Курча табака', emoji: '🍗', time: '30-35хв', description: 'Ціле курча, смажиться під пресом, рубається на 4 шматки. Подається з зеленим соусом (часник, кінза, петрушка, перець чилі)' },
    { name: 'Шкмерулі', emoji: '🍗', time: '30-40хв', description: 'Половина курки смажиться під пресом, тушкується у вершково-часниковому соусі. Посипається грецьким горіхом з кінзою' },
    { name: 'Оджахурі', emoji: '🥩', time: '25-30хв', description: 'Печена картопля зі свининою, томатами, цибулею, болгарським перцем, спеціями. Посипається кінзою' },
    { name: 'Чашушулі з телятини', emoji: '🍲', time: '25-30хв', description: 'Обсмажується з болгарським перцем і томатами, багато спецій, кінза. Трішки гостра' },
    { name: 'Чашушулі з грибів', emoji: '🍄', time: '~20хв', description: 'Печериці смажаться із цибулею, болгарським перцем і помідорами, кінза' },
    { name: 'Стейк курячий', emoji: '🍗', time: '25-30хв', description: '180-300г грудка, подається разом із картоплею по-домашньому' },
    { name: 'Стейк з язика', emoji: '🥩', time: '25-30хв', description: '2 шматки яловичого язика, подається з соусом чімічурі (петрушка, кінза, горіх, оцет, бальзамічний оцет)' },
    { name: 'Медальйони зі свинини та телятини', emoji: '🥩', time: '25-35хв', description: '3 медальйони подаються з вершково-грибним соусом та спаржевою квасолею' },
    { name: 'Філе міньйон', emoji: '🥩', time: '25-30хв', description: '2 шт. = 250-400г. Теляча вирізка подається з зеленим маслом і міксом салату з томатом чері' },
    { name: 'Телятина у вершках', emoji: '🍲', time: '25-30хв', description: 'Обсмажується з болгарським перцем, цибулею, помідором. Тушкується у вершках, багато спецій, кінза' },
    { name: 'Печінка по-грузинськи', emoji: '🍲', time: '25-30хв', description: 'Яловича печінка смажиться з цибулею, посипається гранатом і кінзою' },
    { name: 'Котлета на пару', emoji: '🍖', time: '30-40хв', description: '2 штуки з телятини, подається з морквою' },
    { name: 'Баклажани в кисло-солодкому соусі', emoji: '🍆', time: '25-30хв', description: 'Баклажан нарізається кубиками, смажиться у фритюрі, заправляється кисло-солодким і соєвим соусом з часником, кінза' },
    { name: 'Короп смажений', emoji: '🐟', time: '25-30хв', description: '200-300г. Філе коропа без кісток, смажиться у кукурудзяній муці, подається з лимоном' },
    { name: 'Долма з соусом мацоні', emoji: '🫙', time: '25-30хв', description: 'Начинка — телятина та свинина 50/50 з рисом. Соус мацоні: сметана, часник та зелень' },
  ],
  'main::Хінкалі': [
    { name: 'Хінкалі з м\'ясом', emoji: '🥟', time: '15-20хв', description: '3 шт. Начинка зі свино-телячого фаршу, верхівка кругла' },
    { name: 'Хінкалі з баранини', emoji: '🥟', time: '15-20хв', description: '3 шт. Начинка з фаршу баранини з кінзою, верхівка кругла з дзьобиком' },
    { name: 'Хінкалі з сиром', emoji: '🥟', time: '15-20хв', description: '3 шт. Начинка з сиру сулугуні, бринзи і вершків, верхівка трикутна' },
    { name: 'Хінкалі з грибами', emoji: '🥟', time: '15-20хв', description: '3 шт. Начинка з печериць, цибулі і вершків, верхівка квадратна' },
    { name: 'Хінкалі з сьомгою та шпинатом', emoji: '🥟', time: '20-25хв', description: '3 шт. Начинка з сьомги, шпинату, сулугуні і цибулі. Верхівка кругла, посипається кунжутом' },
    { name: 'Хінкалі з вишнею', emoji: '🍫', time: '15-25хв', description: '3 шт шоколадних хінкалі з вишнею. Подається на англійському кремі з вишневим джемом' },
    { name: 'Хінкалі з сиром надугі та щербетом', emoji: '🍫', time: '15-25хв', description: '3 шт шоколадних хінкалі. Начинка з сиру надугі, щербету (грецький горіх, ізюм, шоколад, цукати апельсину). Подається на англійському кремі з подрібненими цукатами' },
  ],
  'main::Гарніри': [
    { name: 'Картопляне пюре', emoji: '🥔', time: '25-30хв', description: 'Поливається маслом' },
    { name: 'Картопля по-домашньому', emoji: '🥔', time: '25-30хв', description: 'Нарізається кубиками, смажиться у фритюрі, замішується з часниковою пастою' },
    { name: 'Картопля з цибулею', emoji: '🥔', time: '25-30хв', description: 'Нарізається слайсами, смажиться з цибулею, посипається кропом' },
    { name: 'Картопля фрі', emoji: '🍟', time: '~20хв', description: '' },
    { name: 'Гречка', emoji: '🌾', time: '25-30хв', description: 'Поливається маслом' },
    { name: 'Тушковані овочі', emoji: '🥦', time: '25-30хв', description: 'Морква, болгарський перець, баклажан, цвітна капуста, броколі' },
  ],
  'main::Хлібобулочні': [
    { name: 'Хачапурі на мангалі', emoji: '🫓', time: '25-30хв', description: 'Зі листкового тіста, начинка з помідор чері і сиру сулугуні, запікається на мангалі' },
    { name: 'Хачапурі Тифліс', emoji: '🫓', time: '25-30хв', description: 'Бринза, сулугуні, нарізається на 8 шматків, закритий тип' },
    { name: 'Хачапурі Імеретинське', emoji: '🫓', time: '25-30хв', description: 'Бринза, сулугуні, нарізається на 4-6 шматків, закритий тип' },
    { name: 'Хачапурі по-аджарськи', emoji: '🫓', time: '25-30хв', description: 'Бринза, сулугуні з жовтком у формі лодочки' },
    { name: 'Хачапурі з лисичками і дорблю', emoji: '🫓', time: '25-30хв', description: 'У формі лодочки. Начинка: шпинат, суміш грузинських сирів, сир дорблю і лисички. Посипається мигдалевими пластівцями' },
    { name: 'Чебурек', emoji: '🥟', time: '25-30хв', description: '1 шт, телятина-свинина 50/50' },
    { name: 'Лаваш', emoji: '🫓', time: '~10хв', description: 'У формі півмісяця, білий пухкий хлібчик' },
  ],
  'main::Десерти': [
    { name: 'Чорний принц', emoji: '🎂', time: '', description: 'Шоколадні коржі з грецьким горіхом, сметанково-вершковий крем, натертий чорний шоколад' },
    { name: 'Празький', emoji: '🎂', time: '', description: 'Шоколадні коржі, шоколадна глазурь, прослойка з абрикосового джему' },
    { name: 'Львівський сирник', emoji: '🍮', time: '', description: 'Сирна запіканка з ізюмом, полита шоколадом. Прикрашається мигдалевими пластівцями і фісташками' },
    { name: 'Тифліс', emoji: '🍫', time: '', description: 'Аналог снікерсу: шоколадні коржі, згущений крем, арахісово карамельна прослойка' },
    { name: 'П\'яна вишня', emoji: '🎂', time: '', description: 'Шоколадні коржі, творожно сметанний крем з вишнями' },
    { name: 'Фундук', emoji: '🧁', time: '', description: 'Пісочні коржі з фундуком, крем зі згущеного молока, поливається глазуррю і посипається фундучками' },
    { name: 'Східне тістечко', emoji: '🧁', time: '', description: 'Пісочне тісто, вишневий джем, горішки, ізюм і кориця' },
    { name: 'Меренговий рулет', emoji: '🎂', time: '', description: 'Меренга, крем чіз. Посипається мигдальними пластівцями та прикрашається рафаелло' },
    { name: 'Штрудель', emoji: '🥐', time: '', description: 'Листкове тісто, перемелена з горішками вишня. Подається з кулькою морозива' },
    { name: 'Медовик', emoji: '🍯', time: '', description: 'Медові коржі, сметана з медом, зверху кремчіз і білий шоколад. Посипається бджолиним пилком' },
  ],

  'bar::Віскі': [
    { name: 'Chivas Regal', emoji: '🥃', price: '172', description: '1 л · 50 мл — 172 грн · пляшка — 3400 грн' },
    { name: 'Monkey Shoulder', emoji: '🥃', price: '180', description: '0,7 л · 50 мл — 180 грн · пляшка — 2520 грн' },
    { name: 'Tullamore D.E.W.', emoji: '🥃', price: '100', description: '1 л · 50 мл — 100 грн · пляшка — 2000 грн' },
    { name: 'The Glenlivet', emoji: '🥃', price: '200', description: '0,5 л · 50 мл — 200 грн · пляшка — 2000 грн' },
    { name: 'Jameson', emoji: '🥃', price: '100', description: '1 л · 50 мл — 100 грн · пляшка — 2000 грн' },
    { name: 'Jack Daniels', emoji: '🥃', price: '110', description: '1 л · 50 мл — 110 грн · пляшка — 2200 грн' },
    { name: 'Jim Beam', emoji: '🥃', price: '90', description: '1 л · 50 мл — 90 грн · пляшка — 1800 грн' },
    { name: 'West Cork', emoji: '🥃', price: '90', description: '1 л · 50 мл — 90 грн · пляшка — 1800 грн' },
    { name: 'William Lawsons', emoji: '🥃', price: '45', description: '1 л · 50 мл — 45 грн · пляшка — 900 грн' },
  ],
  'bar::Горілка': [
    { name: 'Grey Goose', emoji: '🍸', price: '95', description: '1 л · 50 мл — 95 грн · пляшка — 1900 грн' },
    { name: 'Finlandia', emoji: '🍸', price: '50', description: '0,5 л · 50 мл — 50 грн · пляшка — 500 грн' },
    { name: 'Absolut', emoji: '🍸', price: '55', description: '0,5 л · 50 мл — 55 грн · пляшка — 550 грн' },
    { name: 'Nemiroff De Luxe', emoji: '🍸', price: '45', description: '0,5 л · 50 мл — 45 грн · пляшка — 450 грн' },
    { name: 'Nemiroff Delikat', emoji: '🍸', price: '29', description: '0,5 л · 50 мл — 29 грн · пляшка — 290 грн' },
    { name: 'Козацька рада', emoji: '🍸', price: '29', description: '0,5 л · 50 мл — 29 грн · пляшка — 290 грн' },
    { name: 'Zubrowka Bison Grass', emoji: '🍸', price: '30', description: '0,5 л · 50 мл — 30 грн · пляшка — 300 грн' },
    { name: 'Zubrowka Biala', emoji: '🍸', price: '30', description: '0,5 л · 50 мл — 30 грн · пляшка — 300 грн' },
  ],
  'bar::Ром': [
    { name: 'Captain Morgan', emoji: '🍹', price: '75', description: '1 л · 50 мл — 75 грн · пляшка — 1500 грн' },
    { name: 'Plantation', emoji: '🍹', price: '80', description: '0,7 л · 50 мл — 80 грн · пляшка — 1120 грн' },
    { name: 'Plantation Dark', emoji: '🍹', price: '80', description: '0,7 л · 50 мл — 80 грн · пляшка — 1120 грн' },
    { name: 'Oakheart', emoji: '🍹', price: '75', description: '0,7 л · 50 мл — 75 грн · пляшка — 1500 грн' },
  ],
  'bar::Текіла': [
    { name: 'Jose Cuervo Reposado', emoji: '🌵', price: '85', description: '1 л · 50 мл — 85 грн · пляшка — 1700 грн' },
    { name: 'Jose Cuervo Silver', emoji: '🌵', price: '85', description: '1 л · 50 мл — 85 грн · пляшка — 1700 грн' },
  ],
  'bar::Настоянки': [
    { name: 'Becherovka', emoji: '🌿', price: '70', description: '1 л · 50 мл — 70 грн · пляшка — 1400 грн' },
    { name: 'Xenta Absenta', emoji: '🌿', price: '100', description: '1 л · 50 мл — 100 грн · пляшка — 2000 грн' },
  ],
  'bar::Коньяк та бренді': [
    { name: 'Закарпатський 4р.', emoji: '🥃', price: '45', description: '0,5 л · 50 мл — 45 грн · пляшка — 450 грн' },
    { name: 'Азнаурі 3р.', emoji: '🥃', price: '40', description: '0,5 л · 50 мл — 40 грн · пляшка — 400 грн' },
    { name: 'Азнаурі 4р.', emoji: '🥃', price: '42', description: '0,5 л · 50 мл — 42 грн · пляшка — 420 грн' },
    { name: 'Азнаурі 5р.', emoji: '🥃', price: '45', description: '0,5 л · 50 мл — 45 грн · пляшка — 450 грн' },
    { name: 'Арарат 3р.', emoji: '🥃', price: '76', description: '0,5 л · 50 мл — 76 грн · пляшка — 760 грн' },
    { name: 'Арарат 5р.', emoji: '🥃', price: '96', description: '0,5 л · 50 мл — 96 грн · пляшка — 960 грн' },
    { name: 'Арарат 7р.', emoji: '🥃', price: '120', description: '0,5 л · 50 мл — 120 грн · пляшка — 1200 грн' },
    { name: 'Арарат 10р.', emoji: '🥃', price: '180', description: '0,5 л · 50 мл — 180 грн · пляшка — 1800 грн' },
    { name: 'Old Kakheti 5р.', emoji: '🥃', price: '47', description: '0,5 л · 50 мл — 47 грн · пляшка — 470 грн' },
    { name: 'Hennessy V.S.O.P', emoji: '🥃', price: '390', description: '0,7 л · 50 мл — 390 грн · пляшка — 5460 грн' },
    { name: 'KVINT 20р.', emoji: '🥃', price: '420', description: '0,5 л · 50 мл — 420 грн · пляшка — 4200 грн' },
    { name: 'KVINT 10р.', emoji: '🥃', price: '160', description: '0,5 л · 50 мл — 160 грн · пляшка — 1600 грн' },
    { name: 'KVINT 8р.', emoji: '🥃', price: '90', description: '0,5 л · 50 мл — 90 грн · пляшка — 900 грн' },
    { name: 'KVINT 6р.', emoji: '🥃', price: '70', description: '0,5 л · 50 мл — 70 грн · пляшка — 700 грн' },
    { name: 'Sarajishvili 5р.', emoji: '🥃', price: '95', description: '0,5 л · 50 мл — 95 грн · пляшка — 950 грн' },
    { name: 'Sarajishvili 3р.', emoji: '🥃', price: '75', description: '0,5 л · 50 мл — 75 грн · пляшка — 750 грн' },
    { name: 'Sarajishvili VS', emoji: '🥃', price: '120', description: '0,5 л · 50 мл — 120 грн · пляшка — 1200 грн' },
    { name: 'Sarajishvili VSOP', emoji: '🥃', price: '180', description: '0,5 л · 50 мл — 180 грн · пляшка — 1800 грн' },
  ],
  'bar::Джин': [
    { name: 'Beefeater', emoji: '🍋', price: '75', description: '1 л · 50 мл — 75 грн · пляшка — 1500 грн' },
    { name: 'Finsbury', emoji: '🍋', price: '85', description: '0,7 л · 50 мл — 85 грн · пляшка — 1190 грн' },
  ],
  'bar::Лікери': [
    { name: 'Jagermeister', emoji: '🦌', price: '85', description: '1 л · 50 мл — 85 грн · пляшка — 1700 грн' },
    { name: 'Baileys', emoji: '🍫', price: '90', description: '1 л · 50 мл — 90 грн · пляшка — 1800 грн' },
    { name: 'Kahlua', emoji: '☕', price: '75', description: '1 л · 50 мл — 75 грн · пляшка — 1500 грн' },
    { name: 'Sambuca Molinari', emoji: '⭐', price: '70', description: '1 л · 50 мл — 70 грн · пляшка — 1400 грн' },
  ],
  'bar::Вермути': [
    { name: 'Martini Bianco', emoji: '🍷', price: '40', description: '1 л · 50 мл — 40 грн · пляшка — 800 грн' },
    { name: 'Martini Extra Dry', emoji: '🍷', price: '40', description: '1 л · 50 мл — 40 грн · пляшка — 800 грн' },
  ],
  'bar::Пиво': [
    { name: 'Corona', emoji: '🍺', price: '120', description: '330 мл — 120 грн' },
    { name: 'Hoegaarden', emoji: '🍺', price: '120', description: '330 мл — 120 грн' },
    { name: 'Leffe темне', emoji: '🍺', price: '120', description: '330 мл — 120 грн' },
    { name: 'Wessbeer', emoji: '🍺', price: '70', description: '330 мл — 70 грн' },
    { name: 'Vinnytsia Lager', emoji: '🍺', price: '70', description: '330 мл — 70 грн' },
    { name: 'Corona безалкогольне', emoji: '🍺', price: '120', description: '330 мл — 120 грн' },
    { name: 'Blond Alle (розлив)', emoji: '🍺', price: '80', description: '330 мл — 80 грн · 500 мл — 90 грн' },
    { name: 'Milk Stout (розлив)', emoji: '🍺', price: '80', description: '330 мл — 80 грн · 500 мл — 90 грн' },
  ],
  'bar::Безалкогольні напої': [
    { name: 'Узвар', emoji: '🫖', price: '120', description: '1000 мл — 120 грн' },
    { name: 'Лимонад', emoji: '🍋', price: '120', description: '1000 мл — 120 грн' },
    { name: 'Вода Моршинська газ/негаз', emoji: '💧', price: '70', description: '500 мл — 70 грн' },
    { name: 'Вода Devaitіs газ/негаз', emoji: '💧', price: '60', description: '500 мл — 60 грн' },
    { name: 'Nabeghlavi', emoji: '💧', price: '100', description: '500 мл — 100 грн' },
    { name: 'Coca-Cola / Fanta / Sprite', emoji: '🥤', price: '70', description: '250 мл — 70 грн' },
    { name: 'Schweppes', emoji: '🥤', price: '60', description: '250 мл — 60 грн' },
    { name: 'Burn', emoji: '⚡', price: '80', description: '250 мл — 80 грн' },
    { name: 'Сік Sandora в асортименті', emoji: '🧃', price: '45', description: '250 мл — 45 грн' },
    { name: 'Натахтарі в асортименті', emoji: '🍾', price: '100', description: '500 мл — 100 грн' },
    { name: 'Молочний коктейль з сиропом', emoji: '🥛', price: '110', description: '400 мл — 110 грн' },
    { name: 'Молочний коктейль з бананом', emoji: '🥛', price: '130', description: '400 мл — 130 грн' },
  ],
  'bar::Свіжовіджаті соки': [
    { name: 'Апельсиновий', emoji: '🍊', price: '120', description: '240 мл — 120 грн' },
    { name: 'Грейпфрутовий', emoji: '🍊', price: '130', description: '240 мл — 130 грн' },
    { name: 'Яблучний', emoji: '🍏', price: '90', description: '240 мл — 90 грн' },
    { name: 'Яблучно-морквяний', emoji: '🍏', price: '90', description: '240 мл — 90 грн' },
  ],
  'bar::Чай': [
    { name: 'Чорний / з бергамотом', emoji: '🍵', price: '55', description: '400 мл — 55 грн' },
    { name: 'Зелений / нахабний фрукт', emoji: '🍵', price: '55', description: '400 мл — 55 грн' },
    { name: 'Трав\'яний «Альпійський луг»', emoji: '🌿', price: '55', description: '400 мл — 55 грн' },
    { name: 'Смородиновий', emoji: '🫐', price: '65', description: '400 мл — 65 грн' },
    { name: 'Обліпиховий', emoji: '🌿', price: '65', description: '400 мл — 65 грн' },
  ],
  'bar::Кава': [
    { name: 'Еспресо', emoji: '☕', price: '50', description: '30 мл — 50 грн' },
    { name: 'Американо / Фільтр кава', emoji: '☕', price: '50', description: '100 мл — 50 грн' },
    { name: 'Капучіно / Лате', emoji: '☕', price: '60', description: '200/230 мл — 60 грн' },
  ],
  'bar::Додатково': [
    { name: 'Молоко', emoji: '🥛', price: '10', description: '30 мл — 10 грн' },
    { name: 'Мед', emoji: '🍯', price: '20', description: '50 мл — 20 грн' },
    { name: 'Лимон', emoji: '🍋', price: '10', description: '20 г — 10 грн' },
    { name: 'Лайм', emoji: '🍋', price: '10', description: '10 г — 10 грн' },
    { name: 'Глінтвейн', emoji: '🍷', price: '170', description: '220 мл — 170 грн' },
  ],

  'wine::Вина по бокально': [
    { name: 'Cesari Pinot Grigio delle Venezie DOC', emoji: '🍾', description: 'Італія · біле сухе · 150 мл' },
    { name: 'Saint Clair Sauvignon Blanc Marlborough', emoji: '🍾', description: 'Нова Зеландія · біле сухе · 150 мл' },
    { name: 'Dr. Heidemanns-Bergweiler Riesling Trocken', emoji: '🍾', description: 'Німеччина · біле сухе · 150 мл' },
    { name: 'Pfefferer Classic Line', emoji: '🍾', description: 'Італія · біле н/сухе · 150 мл' },
    { name: 'Dr. Heidemanns-Bergweiler Riesling', emoji: '🍾', description: 'Німеччина · біле н/солодке · 150 мл' },
    { name: 'Callia Esperado Viognier Torrontes', emoji: '🍾', description: 'Аргентина · біле н/солодке · 150 мл' },
    { name: 'Chatelein Desjacques Rose d\'Anjou', emoji: '🌸', description: 'Франція · рожеве н/сухе · 150 мл' },
    { name: 'Diomede Troia Pinot Alte', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл' },
    { name: 'Bourgrier Pinot Noir', emoji: '🍷', description: 'Франція · червоне сухе · 150 мл' },
    { name: 'Tareni Nero d\'Avola Terre Siciliane IGP', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл' },
    { name: 'Carmenere Leon de Tarapaca', emoji: '🍷', description: 'Чилі · червоне сухе · 150 мл' },
    { name: 'Schenk Primitivo di Manduria Brunile', emoji: '🍷', description: 'Італія · червоне н/сухе · 150 мл' },
    { name: 'Callia Esperado Shiraz Malbec', emoji: '🍷', description: 'Аргентина · червоне н/солодке · 150 мл' },
    { name: 'Dr. Heidemanns-Bergweiler Dornfelder', emoji: '🍷', description: 'Німеччина · червоне н/солодке · 150 мл' },
    { name: 'Torres Garnacha-Syrah Natureo', emoji: '🍇', description: 'Безалкогольне · червоне н/солодке · 150 мл' },
    { name: 'Torres Muscat Natureo', emoji: '🍇', description: 'Безалкогольне · біле н/солодке · 150 мл' },
    { name: 'Mateus', emoji: '🌸', description: 'Рожеве н/солодке · 150 мл' },
    { name: 'GiGi Merlot Family Collection', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Saperavi Family Collection', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Rkatsiteli Reserve', emoji: '🍾', description: 'Україна · біле сухе · 150 мл' },
    { name: 'GiGi Cabernet Reserve', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Merlot Reserve', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Alibernet Reserve', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Chardonnay', emoji: '🍾', description: 'Україна · біле сухе · 150 мл' },
    { name: 'GiGi Rkatsiteli', emoji: '🍾', description: 'Україна · біле сухе · 150 мл' },
    { name: 'GiGi Rose', emoji: '🌸', description: 'Україна · рожеве сухе · 150 мл' },
    { name: 'GiGi Cabernet', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Black', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Merlot', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл' },
    { name: 'GiGi Vinnytske біле', emoji: '🍾', description: 'Україна · біле н/солодке · 150 мл' },
    { name: 'GiGi Vinnytske рожеве', emoji: '🌸', description: 'Україна · рожеве н/солодке · 150 мл' },
    { name: 'GiGi Vinnytske червоне', emoji: '🍷', description: 'Україна · червоне н/солодке · 150 мл' },
    { name: 'Rkatsiteli QVEVRI', emoji: '🏺', description: 'Помаранчеве сухе · 150 мл' },
    { name: 'Chardonnay QVEVRI', emoji: '🏺', description: 'Помаранчеве сухе · 150 мл' },
    { name: 'Odesa Black QVEVRI', emoji: '🏺', description: 'Червоне сухе · 150 мл' },
    { name: 'Saperavi QVEVRI', emoji: '🏺', description: 'Червоне сухе · 150 мл' },
    { name: 'Chardonnay Reserve', emoji: '🍾', description: 'Біле сухе · 150 мл' },
    { name: 'Sauvignon Blanc Reserve', emoji: '🍾', description: 'Біле сухе · 150 мл' },
    { name: 'Rkatsiteli Amber Reserve', emoji: '🏺', description: 'Помаранчеве сухе · 150 мл' },
  ],
  'wine::Коравін': [
    { name: 'Domaine Marchand & Fils Pouilly-Fume', emoji: '🍾', description: 'Франція · біле сухе · 150 мл (Коравін)' },
    { name: 'Chablis 2021 Billaud-Simon', emoji: '🍾', description: 'Франція · біле сухе · 150 мл (Коравін)' },
    { name: 'Chateau Lafon', emoji: '🍾', description: 'Франція · біле солодке · 150 мл (Коравін)' },
    { name: 'Kisi Rcheuli Qvevri', emoji: '🏺', description: 'Грузія · оранж сухе · 150 мл (Коравін)' },
    { name: 'Farnese Canace Nero Di Troia', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл (Коравін)' },
    { name: 'Giacomo Fenocchio Barolo Bussia', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл (Коравін)' },
    { name: 'Schenk Chianti Classico Riserva Cavatina', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл (Коравін)' },
    { name: 'Амароне Вальполічелла Кантіна Ді Ора', emoji: '🍷', description: 'Італія · червоне н/сухе · 150 мл (Коравін)' },
    { name: 'Valpolicella Superiore Ripasso Marogne Zeni', emoji: '🍷', description: 'Італія · червоне сухе · 150 мл (Коравін)' },
    { name: 'Бейкуш Кара Кармен', emoji: '🍷', description: 'Україна · червоне сухе · 150 мл (Коравін)' },
    { name: 'Vina Tondonia Tinto Reserva 2009', emoji: '🍷', description: 'Іспанія · червоне сухе · 150 мл (Коравін)' },
    { name: 'Mercurey 1er Cru Les Cret 2021', emoji: '🍷', description: 'Франція · червоне сухе · 150 мл (Коравін)' },
  ],
  'wine::Коравін ігристе': [
    { name: 'Bollinger Rosé', emoji: '🥂', description: 'Шампанське · Франція · брют · 150 мл (Коравін)' },
    { name: 'Veuve Clicquot BRUT біле', emoji: '🥂', description: 'Шампанське · Франція · брют · 150 мл (Коравін)' },
    { name: 'Cava Jaume Serra Semi Seco', emoji: '🥂', description: 'Іспанія · біле н/сухе · 150 мл (Коравін)' },
    { name: 'Dal Bello Don Gallo Prosecco', emoji: '🥂', description: 'Італія · брют · 150 мл (Коравін)' },
    { name: 'Felix біле ігристе б/а', emoji: '🥂', description: 'Іспанія · безалкогольне · 150 мл (Коравін)' },
  ],
  'wine::Шампанське': [
    { name: 'Veuve Clicquot BRUT', emoji: '🥂', price: '4500', description: 'Франція · 750 мл — 4500 грн' },
    { name: 'Champagne Lanson', emoji: '🥂', price: '3800', description: 'Франція · 750 мл — 3800 грн' },
    { name: 'Piper-Heidsieck Essential Brut Non Vintage', emoji: '🥂', price: '4200', description: 'Франція · 750 мл — 4200 грн' },
    { name: 'Taittinger Brut Reserve', emoji: '🥂', price: '3700', description: 'Франція · 750 мл — 3700 грн' },
    { name: 'Maurice Vesselle Cuvee Reservee Grand Cru', emoji: '🥂', price: '3500', description: 'Франція · 750 мл — 3500 грн' },
    { name: 'Bollinger Rosé', emoji: '🥂', price: '5200', description: 'Франція · 750 мл — 5200 грн' },
  ],
  'wine::Ігристі вина': [
    { name: 'Cremant D\'Alsace Arthur Metz', emoji: '🍾', price: '1100', description: 'Франція · 750 мл — 1100 грн' },
    { name: 'Hortense Cremant de Bordeaux', emoji: '🍾', price: '1200', description: 'Франція · 750 мл — 1200 грн' },
    { name: 'Chartron et Trebuchet Cremant de Bourgogne', emoji: '🍾', price: '1200', description: 'Франція · 750 мл — 1200 грн' },
    { name: 'Ca\' del Bosco Cuvee Prestige', emoji: '🍾', price: '2500', description: 'Італія · 750 мл — 2500 грн' },
    { name: 'Ferrari Maximum Brut', emoji: '🍾', price: '2300', description: 'Італія · 750 мл — 2300 грн' },
    { name: 'Asti DOCG Canti Liberty', emoji: '🍾', price: '750', description: 'Італія · 750 мл — 750 грн' },
    { name: 'Prosecco Treviso Extra Dry', emoji: '🍾', price: '820', description: 'Італія · 750 мл — 820 грн' },
    { name: 'Cava Jaume Serra Brut', emoji: '🍾', price: '600', description: 'Іспанія · 750 мл — 600 грн' },
    { name: 'Cava Jaume Serra Semi Seco', emoji: '🍾', price: '620', description: 'Іспанія · 750 мл — 620 грн' },
    { name: 'Vallformosa Origen Cava Brut Rose', emoji: '🌸', price: '780', description: 'Іспанія · 750 мл — 780 грн' },
    { name: 'Brundlmayer Rose', emoji: '🌸', price: '2300', description: 'Австрія · 750 мл — 2300 грн' },
    { name: 'Marlborough Sun', emoji: '🍾', price: '990', description: 'Нова Зеландія · 750 мл — 990 грн' },
  ],
  'wine::Вина України (GiGi Winery)': [
    { name: 'Merlot Family Collection', emoji: '🍷', price: '1400', description: 'GiGi Winery · 750 мл — 1400 грн' },
    { name: 'Saperavi Family Collection', emoji: '🍷', price: '1400', description: 'GiGi Winery · 750 мл — 1400 грн' },
    { name: 'Rkatsiteli Reserve', emoji: '🍾', price: '1200', description: 'GiGi Winery · 750 мл — 1200 грн' },
    { name: 'Alibernet Reserve', emoji: '🍷', price: '1580', description: 'GiGi Winery · 750 мл — 1580 грн' },
    { name: 'Rkatsiteli QVEVRI', emoji: '🏺', price: '1580', description: 'GiGi Winery · 750 мл — 1580 грн' },
    { name: 'Odesa Black QVEVRI', emoji: '🏺', price: '1580', description: 'GiGi Winery · 750 мл — 1580 грн' },
    { name: 'Vinnytske біле', emoji: '🍾', price: '640', description: 'GiGi Winery · 750 мл — 640 грн' },
    { name: 'Vinnytske рожеве', emoji: '🌸', price: '640', description: 'GiGi Winery · 750 мл — 640 грн' },
    { name: 'Vinnytske червоне', emoji: '🍷', price: '640', description: 'GiGi Winery · 750 мл — 640 грн' },
  ],
  'wine::Білі вина (світ)': [
    { name: 'Sancerre Pascal Jolivet', emoji: '🍾', price: '2100', description: 'Франція · 750 мл — 2100 грн' },
    { name: 'Chablis Billaud-Simon', emoji: '🍾', price: '2400', description: 'Франція · 750 мл — 2400 грн' },
    { name: 'Gavi di Gavi La Toledana', emoji: '🍾', price: '1150', description: 'Італія · 750 мл — 1150 грн' },
    { name: 'Pfefferer Classic Line', emoji: '🍾', price: '1050', description: 'Італія · 750 мл — 1050 грн' },
    { name: 'Lugana Ca Dei Frati', emoji: '🍾', price: '1240', description: 'Італія · 750 мл — 1240 грн' },
    { name: 'Dr. Loosen Graacher 2021', emoji: '🍾', price: '1100', description: 'Німеччина · 750 мл — 1100 грн' },
    { name: 'Riesling Peter Nicolay', emoji: '🍾', price: '600', description: 'Німеччина · 750 мл — 600 грн' },
    { name: 'Saint Clair Sauvignon Blanc', emoji: '🍾', price: '880', description: 'Нова Зеландія · 750 мл — 880 грн' },
  ],
  'wine::Червоні вина (світ)': [
    { name: 'Chateauneuf-du-Pape', emoji: '🍷', price: '2800', description: 'Франція · 750 мл — 2800 грн' },
    { name: 'Gevrey-Chambertin 1er Cru', emoji: '🍷', price: '5700', description: 'Франція · 750 мл — 5700 грн' },
    { name: 'Barolo Bussia Giacomo Fenocchio', emoji: '🍷', price: '3000', description: 'Італія · 750 мл — 3000 грн' },
    { name: 'Amarone Valpolicella', emoji: '🍷', price: '3900', description: 'Італія · 750 мл — 3900 грн' },
    { name: 'Brunello di Montalcino', emoji: '🍷', price: '2500', description: 'Італія · 750 мл — 2500 грн' },
    { name: 'Vina Tondonia Reserva', emoji: '🍷', price: '2300', description: 'Іспанія · 750 мл — 2300 грн' },
    { name: 'Vega Sicilia Unico 2014', emoji: '🍷', price: '25000', description: 'Іспанія · 750 мл — 25000 грн' },
    { name: '1924 Bourbon Barrel Cabernet Sauvignon', emoji: '🍷', price: '1280', description: 'США · 750 мл — 1280 грн' },
  ],
  'wine::Портвейни та десертні': [
    { name: 'Symington 10yo Tawny', emoji: '🍷', price: '2300', description: 'Портвейн · 2300 грн' },
    { name: 'Lustau Pedro Ximenez San Emilio', emoji: '🍷', price: '1600', description: 'Херес · 1600 грн' },
    { name: 'Tarapaca Late Harvest', emoji: '🍯', price: '520', description: 'Десертне · 500 мл — 520 грн' },
  ],
  'lunch::Понеділок': [
    { name: 'Борщ червоний', emoji: '🍲', description: 'Суп' },
    { name: 'Люля на мангалі', emoji: '🍖', description: 'Основне' },
    { name: 'Пюре / молода картопля', emoji: '🥔', description: 'Гарнір' },
    { name: 'С-т з молодої капусти', emoji: '🥗', description: 'Салат' },
  ],
  'lunch::Вівторок': [
    { name: 'Мінестроне', emoji: '🍲', description: 'Суп' },
    { name: 'Курка тереяки', emoji: '🍗', description: 'Основне' },
    { name: 'Шафрановий рис', emoji: '🍚', description: 'Гарнір' },
    { name: 'С-т з язиком', emoji: '🥗', description: 'Салат' },
  ],
  'lunch::Середа': [
    { name: 'Борщ зелений', emoji: '🍲', description: 'Суп' },
    { name: 'Запечені голубці', emoji: '🥬', description: 'Основне' },
    { name: 'С-т овочевий із зеленим соусом', emoji: '🥗', description: 'Салат' },
  ],
  'lunch::Четвер': [
    { name: 'Ворі-Ворі', emoji: '🍲', description: 'Суп' },
    { name: 'Курячі шашлички', emoji: '🍗', description: 'Основне' },
    { name: 'Картопля айдахо', emoji: '🍟', description: 'Гарнір' },
    { name: 'С-т з молодої капусти з овочами', emoji: '🥗', description: 'Салат' },
  ],
  'lunch::Пятниця': [
    { name: 'Бульйон з півня', emoji: '🍲', description: 'Суп' },
    { name: 'Свинина в кислосолодкому', emoji: '🍖', description: 'Основне' },
    { name: 'Птітім', emoji: '🍚', description: 'Гарнір' },
    { name: 'С-т з томатів', emoji: '🥗', description: 'Салат' },
  ],
};

const Menu = {
  init() {
    // Ініціалізувати структуру меню в DB
    const existing = DB.get('menu_items');
    if (!existing) {
      DB.set('menu_items', DEFAULT_MENU_ITEMS);
    } else {
      // Доповнити бар-даними якщо їх ще немає
      let changed = false;
      Object.keys(DEFAULT_MENU_ITEMS).forEach(key => {
        if (!existing[key]) {
          existing[key] = DEFAULT_MENU_ITEMS[key];
          changed = true;
        }
      });
      if (changed) DB.set('menu_items', existing);
    }
    const WINE_DEFAULT_CATS = ['Вина по бокально','Коравін','Коравін ігристе','Шампанське','Ігристі вина','Вина України (GiGi Winery)','Білі вина (світ)','Червоні вина (світ)','Портвейни та десертні'];
    const existingWineCats = DB.get('menu_wine_cats');
    if (!existingWineCats || existingWineCats.length === 0) {
      DB.set('menu_wine_cats', WINE_DEFAULT_CATS);
    }

    Menu.renderSectionTabs();
    Menu.renderAdminBtns();
    // Очистити поле пошуку при переході на сторінку
    const si = $('menu-search-input');
    if (si) { si.value = ''; }
    const sc = $('menu-search-clear');
    if (sc) sc.style.display = 'none';
    Menu.renderSection(menuActiveSection);
  },

  // ── Пошук по меню ───────────────────────────────────────────────

  _searchTimer: null,

  onSearch(query) {
    // Показати/сховати кнопку очищення
    const clearBtn = $('menu-search-clear');
    if (clearBtn) clearBtn.style.display = query.length ? 'block' : 'none';

    // Debounce 200ms — не шукаємо при кожному символі
    clearTimeout(Menu._searchTimer);
    if (!query.trim()) {
      // Повернутися до звичайного вигляду
      $('menu-section-tabs').style.display = '';
      Menu.renderSection(menuActiveSection);
      return;
    }
    Menu._searchTimer = setTimeout(() => Menu._doSearch(query.trim()), 200);
  },

  clearSearch() {
    const input = $('menu-search-input');
    if (input) input.value = '';
    $('menu-search-clear').style.display = 'none';
    $('menu-section-tabs').style.display = '';
    Menu.renderSection(menuActiveSection);
  },

  _doSearch(query) {
    const q = query.toLowerCase();
    const sections = Menu.getSections();
    const allItems = DB.get('menu_items', {});
    const results = []; // { sectionLabel, cat, item, idx, sectionKey }

    sections.forEach(sec => {
      sec.categories.forEach(cat => {
        const items = allItems[`${sec.key}::${cat}`] || [];
        items.forEach((item, idx) => {
          const haystack = [
            item.name, item.description, item.weight,
            item.allergens?.join(' '), cat, sec.label,
          ].filter(Boolean).join(' ').toLowerCase();
          if (haystack.includes(q)) {
            results.push({ sectionKey: sec.key, sectionLabel: sec.label, cat, item, idx });
          }
        });
      });
    });

    // Ховаємо вкладки секцій під час пошуку
    $('menu-section-tabs').style.display = 'none';

    const content = $('menu-section-content');
    if (!results.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text-dim)">
          <div style="font-size:40px;margin-bottom:14px">🔍</div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">Нічого не знайдено</div>
          <div style="font-size:12px;margin-top:6px">Спробуйте іншу назву або категорію</div>
        </div>`;
      return;
    }

    // Підсвічування збігу в тексті
    function highlight(text) {
      if (!text) return '';
      const idx = text.toLowerCase().indexOf(q);
      if (idx === -1) return esc(text);
      return esc(text.slice(0, idx))
        + `<mark style="background:rgba(212,175,55,.35);color:var(--text);border-radius:2px;padding:0 2px">${esc(text.slice(idx, idx + q.length))}</mark>`
        + esc(text.slice(idx + q.length));
    }

    // Групуємо результати по розділу
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.sectionKey]) grouped[r.sectionKey] = { label: r.sectionLabel, items: [] };
      grouped[r.sectionKey].items.push(r);
    });

    let html = `<div style="font-size:11px;color:var(--text-dim);margin-bottom:16px;font-weight:600">
      Знайдено: <span style="color:var(--gold)">${results.length}</span> позицій
    </div>`;

    Object.values(grouped).forEach(group => {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--gold-border)">${esc(group.label)}</div>`;
      html += `<div class="menu-items-grid" style="margin-bottom:24px">`;
      group.items.forEach(({ sectionKey, cat, item, idx }) => {
        const catEnc = encodeURIComponent(cat);
        html += `<div class="menu-item-card"
            onclick="Menu.showItem('${sectionKey}','${catEnc}',${idx})"
            style="position:relative">
          <div class="menu-item-img" style="position:relative">
            ${item.photo ? `<img src="${item.photo}" alt="${esc(item.name)}" loading="lazy">` : (item.emoji || '🍽️')}
          </div>
          <div class="menu-item-body">
            <div class="menu-item-name">${highlight(item.name)}</div>
            ${item.price ? `<div class="menu-item-price">${esc(item.price)} ₴</div>` : ''}
            <div style="font-size:9px;color:var(--text-muted);margin-top:3px">${highlight(cat)}</div>
          </div>
        </div>`;
      });
      html += `</div>`;
    });

    content.innerHTML = html;
  },

  getSections() {
    const wineCats = DB.get('menu_wine_cats', []);
    const wineSection = MENU_SECTIONS.find(s => s.key === 'wine');
    const fallbackCats = wineSection ? wineSection.categories : [];
    // Збережені категорії для season/banquet/lean
    const customCats = DB.get(LS_KEYS.MENU_CUSTOM_CATS, {});
    return MENU_SECTIONS.map(s => {
      if (s.key === 'wine') return { ...s, categories: wineCats.length ? wineCats : fallbackCats };
      if (['season','banquet','lean'].includes(s.key) && customCats[s.key]) {
        return { ...s, categories: customCats[s.key] };
      }
      return s;
    });
  },

  renderAdminBtns() {
    const el = $('menu-admin-btns');
    if (isAdmin(currentUser)) {
      el.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-gold btn-sm" onclick="Menu.openAddItem()">＋ Додати страву</button>
        </div>`;
    } else {
      el.innerHTML = '';
    }
  },

  getSectionCovers() {
    return DB.get('menu_section_covers', {});
  },

  saveSectionCover(sectionKey, url) {
    const covers = Menu.getSectionCovers();
    covers[sectionKey] = url;
    DB.set('menu_section_covers', covers);
  },

  openSectionCoverEdit(sectionKey) {
    const covers = Menu.getSectionCovers();
    const current = covers[sectionKey] || '';
    showModal(`
      <div style="font-size:16px;font-weight:800;margin-bottom:16px;color:var(--gold)">🖼️ Фото вкладки меню</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:14px">Це фото-банер показується вгорі вкладки для всіх користувачів.</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group">
          <label class="lbl">URL фото</label>
          <input type="text" id="section-cover-url" class="field" value="${current}" placeholder="https://...">
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="btn btn-outline btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <input type="file" id="section-cover-file" accept="image/*" style="display:none"
              onchange="Menu._uploadSectionCover(this,'${sectionKey}')">
            📁 Завантажити з пристрою
          </label>
          <span id="section-cover-status" style="font-size:11px;color:var(--text-dim)"></span>
        </div>
        <div id="section-cover-preview" style="margin-top:4px">
          ${current?`<img src="${current}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)">`:''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-gold" onclick="Menu._saveSectionCoverFromModal('${sectionKey}')">Зберегти</button>
        ${current?`<button class="btn btn-danger btn-sm" onclick="Menu._clearSectionCover('${sectionKey}')">Видалити фото</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>`);
  },

  async _uploadSectionCover(input, sectionKey) {
    const file = input.files[0];
    if (!file) return;
    const status = $('section-cover-status');
    const label = input.closest('label');
    if (status) status.textContent = '⏳ Завантаження...';
    if (label) { label.style.opacity = '.5'; label.style.pointerEvents = 'none'; }
    try {
      const url = await uploadImageFile(file, 'images', 'menu-covers');
      const urlInput = $('section-cover-url');
      if (urlInput) urlInput.value = url;
      const preview = $('section-cover-preview');
      if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)">`;
      if (status) status.textContent = '✓ Завантажено';
    } catch(e) {
      toast('Помилка завантаження: ' + e.message, 'error');
      if (status) status.textContent = '';
    } finally {
      if (label) { label.style.opacity = ''; label.style.pointerEvents = ''; }
    }
  },

  async _saveSectionCoverFromModal(sectionKey) {
    const url = $('section-cover-url')?.value.trim() || '';
    Menu.saveSectionCover(sectionKey, url);
    try {
      const covers = Menu.getSectionCovers();
      await sb.upsert('settings', { key: 'menu_section_covers', value: JSON.stringify(covers) }, 'key');
    } catch(e) { console.warn('Cover save to DB failed:', e); }
    closeModal();
    Menu.renderSection(sectionKey);
    toast('Фото збережено', 'success-t');
  },

  async _clearSectionCover(sectionKey) {
    Menu.saveSectionCover(sectionKey, '');
    try {
      const covers = Menu.getSectionCovers();
      await sb.upsert('settings', { key: 'menu_section_covers', value: JSON.stringify(covers) }, 'key');
    } catch(e) { console.warn('Cover clear to DB failed:', e); }
    closeModal();
    Menu.renderSection(sectionKey);
  },

  renderSectionTabs() {
    const tabs = $('menu-section-tabs');
    tabs.innerHTML = Menu.getSections().map(s =>
      `<div style="position:relative;display:inline-flex;align-items:center;gap:0">
        <button class="menu-section-tab ${s.key===menuActiveSection?'active':''}"
          onclick="Menu.renderSection('${s.key}')">${s.label}</button>
        ${isAdmin(currentUser)?`<button onclick="Menu.openSectionCoverEdit('${s.key}')" title="Змінити фото вкладки"
          style="background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;color:var(--text-muted);line-height:1;margin-left:-2px;margin-top:-18px" >🖼️</button>`:''}
      </div>`
    ).join('');
  },

  _renderCache: {},    // { sectionKey: hashString }
  _renderedSection: null, // яка секція зараз в DOM

  renderSection(sectionKey) {
    menuActiveSection = sectionKey;
    menuActiveCategory = null;
    Menu.renderSectionTabs();

    const sec = Menu.getSections().find(s => s.key === sectionKey);
    const content = $('menu-section-content');
    if (!sec || !content) return;

    // ── Хеш-перевірка: не рендеримо якщо дані не змінились І секція та сама ──
    const covers    = Menu.getSectionCovers();
    const hashInput = JSON.stringify({ cats: sec.categories, covers: covers[sectionKey], admin: isAdmin(currentUser) });
    if (Menu._renderCache[sectionKey] === hashInput && Menu._renderedSection === sectionKey) return;
    Menu._renderCache[sectionKey] = hashInput;
    Menu._renderedSection = sectionKey;

    let html = '';

    // Cover photo banner
    if (covers[sectionKey]) {
      html += `<div style="width:100%;height:160px;border-radius:12px;overflow:hidden;margin-bottom:18px;border:1px solid var(--gold-border)">
        <img src="${covers[sectionKey]}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
      </div>`;
    }

    // Для Винної карти — кнопка додати підкатегорію
    if (sectionKey === 'wine' && isAdmin(currentUser)) {
      html += `<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">
        <input type="text" id="wine-cat-input" class="field" placeholder="Назва підрозділу (напр. Червоні вина)" style="max-width:280px">
        <button class="btn btn-outline btn-sm" onclick="Menu.addWineCat()">＋ Підрозділ</button>
      </div>`;
    }

    // Кнопки категорій
    if (sec.categories.length === 0 && sectionKey !== 'wine') {
      html += `<div style="text-align:center;padding:40px;color:var(--text-dim)">
        <div style="font-size:32px;margin-bottom:10px">📋</div>
        <div style="font-size:13px">Розділ порожній</div>
        ${isAdmin(currentUser)
          ? `<button class="btn btn-gold" style="margin-top:16px" onclick="Menu.openAddItem('${sectionKey}','')">＋ Додати першу страву</button>`
          : ''}
      </div>`;
    } else {
      const isCustomSection = ['season','banquet','lean','wine'].includes(sectionKey);
      html += sec.categories.map(cat => {
        const items = Menu.getItems(sectionKey, cat);
        const catEnc = encodeURIComponent(cat);
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <button class="menu-category-btn" style="flex:1;margin-bottom:0" onclick="Menu.toggleCategory('${sectionKey}','${catEnc}',this)">
            <span>${esc(cat)}</span>
            <span class="cat-count">${items.length} поз. ›</span>
          </button>
          ${isAdmin(currentUser) && isCustomSection
            ? `<button onclick="Menu.openRenameCategory('${sectionKey}','${catEnc}')"
                style="background:rgba(255,255,255,.06);border:1px solid var(--gold-border);border-radius:10px;padding:8px 10px;cursor:pointer;font-size:13px;flex-shrink:0;color:var(--text-dim)" title="Перейменувати">✏️</button>`
            : ''}
        </div>
        <div id="cat-${sectionKey}-${catEnc}" class="hidden" style="margin-bottom:16px"></div>`;
      }).join('');
    }

    content.innerHTML = html;
  },

  openRenameCategory(sectionKey, catEncoded) {
    const oldName = decodeURIComponent(catEncoded);
    showModal(`<div>
      <h3 style="margin:0 0 16px">Перейменувати категорію</h3>
      <div class="form-group">
        <label class="form-label">Нова назва</label>
        <input id="rename-cat-input" class="field" value="${oldName}" placeholder="Назва категорії">
      </div>
      <div class="modal-footer">
        <button class="btn btn-gold" onclick="Menu.confirmRenameCategory('${sectionKey}','${catEncoded}')">Зберегти</button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>
    </div>`);
    setTimeout(() => {
      const inp = $('rename-cat-input');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  },

  async confirmRenameCategory(sectionKey, catEncoded) {
    const oldName = decodeURIComponent(catEncoded);
    const newName = $('rename-cat-input')?.value.trim();
    if (!newName || newName === oldName) { closeModal(); return; }

    // 1. Оновити menu_sections_custom
    const customCats = DB.get(LS_KEYS.MENU_CUSTOM_CATS, {});
    if (customCats[sectionKey]) {
      customCats[sectionKey] = customCats[sectionKey].map(c => c === oldName ? newName : c);
      DB.set(LS_KEYS.MENU_CUSTOM_CATS, customCats);
    }
    // Те саме для wine
    if (sectionKey === 'wine') {
      const wineCats = DB.get('menu_wine_cats', []);
      const idx = wineCats.indexOf(oldName);
      if (idx !== -1) { wineCats[idx] = newName; DB.set('menu_wine_cats', wineCats); }
    }

    // 2. Перенести страви зі старого ключа на новий
    const allItems = DB.get('menu_items', {});
    const oldKey = `${sectionKey}::${oldName}`;
    const newKey = `${sectionKey}::${newName}`;
    if (allItems[oldKey]) {
      allItems[newKey] = allItems[oldKey];
      delete allItems[oldKey];
      DB.set('menu_items', allItems);
    }

    // 3. Зберегти все в Supabase
    try {
      await Promise.all([
        sb.upsert('settings', { key: 'menu_items',           value: JSON.stringify(allItems) }, 'key'),
        sb.upsert('settings', { key: LS_KEYS.MENU_CUSTOM_CATS, value: JSON.stringify(customCats) }, 'key'),
        sectionKey === 'wine'
          ? sb.upsert('settings', { key: 'menu_wine_cats', value: JSON.stringify(DB.get('menu_wine_cats',[])) }, 'key')
          : Promise.resolve(),
      ]);
      toast(`"${oldName}" → "${newName}"`, 'success-t');
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error(e);
    }

    closeModal();
    Menu.renderSection(sectionKey);
  },

  toggleCategory(sectionKey, catEncoded, btn) {
    const cat = decodeURIComponent(catEncoded);
    const containerId = `cat-${sectionKey}-${catEncoded}`;
    const container = $(containerId);
    if (!container) return;
    const isOpen = !container.classList.contains('hidden');
    if (isOpen) {
      container.classList.add('hidden');
      btn.querySelector('.cat-count') && (btn.querySelector('.cat-count').textContent =
        Menu.getItems(sectionKey, cat).length + ' поз. ›');
    } else {
      container.classList.remove('hidden');
      btn.querySelector('.cat-count') && (btn.querySelector('.cat-count').textContent = '▲');
      Menu.renderCategoryItems(sectionKey, cat, container);
    }
  },

  getItems(sectionKey, category) {
    const all = DB.get('menu_items', {});
    const key = `${sectionKey}::${category}`;
    return all[key] || [];
  },

  saveItems(sectionKey, category, items) {
    const all = DB.get('menu_items', {});
    all[`${sectionKey}::${category}`] = items;
    DB.set('menu_items', all);
    // Зберігаємо в Supabase — щоб всі користувачі бачили зміни
    clearTimeout(Menu._saveTimer);
    Menu._saveTimer = setTimeout(() => Menu._persistToSupabase(), 600);
  },

  _saveTimer: null,

  async _persistToSupabase() {
    try {
      await sb.upsert('settings', { key: 'menu_items', value: JSON.stringify(DB.get('menu_items', {})) }, 'key');
    } catch(e) { console.error('menu_items save error:', e); }
    // Зберігаємо кастомні категорії (season/banquet/lean)
    const customCats = DB.get(LS_KEYS.MENU_CUSTOM_CATS, {});
    if (Object.keys(customCats).length) {
      try {
        await sb.upsert('settings', { key: LS_KEYS.MENU_CUSTOM_CATS, value: JSON.stringify(customCats) }, 'key');
      } catch(e) { console.error('menu_sections_custom save error:', e); }
    }
  },

  renderCategoryItems(sectionKey, categoryOrEnc, container) {
    const category = decodeURIComponent(categoryOrEnc);
    const items   = Menu.getItems(sectionKey, category);
    const canEdit = isAdmin(currentUser);
    const catEnc  = encodeURIComponent(category);

    const parts = ['<div class="menu-items-grid">'];

    if (canEdit) {
      parts.push(`<div class="menu-item-card" style="display:flex;align-items:center;justify-content:center;min-height:160px;border-style:dashed;cursor:pointer"
        onclick="Menu.openAddItem('${sectionKey}','${catEnc}')">
        <div style="text-align:center;color:var(--text-muted)">
          <div style="font-size:28px">＋</div>
          <div style="font-size:11px;margin-top:4px">Додати</div>
        </div>
      </div>`);
    }

    items.forEach((item, idx) => {
      parts.push(`<div class="menu-item-card"
          onclick="Menu.showItem('${sectionKey}','${catEnc}',${idx})"
          style="position:relative">
        <div class="menu-item-img" style="position:relative">
          ${item.photo ? `<img src="${item.photo}" alt="${esc(item.name)}" loading="lazy">` : (item.emoji || '🍽️')}
        </div>
        <div class="menu-item-body">
          <div class="menu-item-name">${esc(item.name)}</div>
          ${item.price    ? `<div class="menu-item-price">${esc(item.price)} ₴</div>` : ''}
          ${item.cookTime ? `<div class="menu-item-time">⏱ ${esc(item.cookTime)} хв</div>` : ''}
        </div>
        ${canEdit ? `<div style="display:flex;gap:4px;position:absolute;bottom:8px;right:8px" onclick="event.stopPropagation()">
          <button class="menu-item-edit-btn" style="position:static" onclick="event.stopPropagation();Menu.openEditItem('${sectionKey}','${catEnc}',${idx})">✏️</button>
        </div>` : ''}
      </div>`);
    });

    parts.push('</div>');
    // Один join → один запис у DOM → мінімальний reflow
    container.innerHTML = parts.join('');
  },

  showItem(sectionKey, catEncoded, idx) {
    const cat = decodeURIComponent(catEncoded);
    const item = Menu.getItems(sectionKey, cat)[idx];
    if (!item) return;
    const canEdit = isAdmin(currentUser);

    showModal(`<div class="dish-modal" style="padding:0">
      ${item.photo
        ? `<div style="width:100%;border-radius:20px 20px 0 0;overflow:hidden;background:var(--eden-dark)">
             <img src="${item.photo}" alt="${esc(item.name)}" loading="lazy" style="width:100%;height:auto;display:block;max-height:320px;object-fit:contain">
           </div>`
        : `<div style="font-size:64px;text-align:center;padding:32px 0 16px;border-radius:20px 20px 0 0;background:var(--eden-light)">${item.emoji||'🍽️'}</div>`
      }
      <div style="padding:18px 20px 0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-size:20px;font-weight:800">${esc(item.name)}</div>
            ${item.weight?`<div style="font-size:11px;color:var(--text-dim);margin-top:2px">${esc(item.weight)}</div>`:''}
          </div>
          ${item.price?`<div style="font-size:22px;font-weight:800;color:var(--gold)">${esc(item.price)} ₴</div>`:''}
        </div>
        ${item.description?`<p style="font-size:12px;color:var(--text-dim);line-height:1.6;margin-bottom:12px">${esc(item.description)}</p>`:''}
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
          ${item.cookTime?`<div style="font-size:11px"><span style="color:var(--text-dim)">⏱ Без навантаження:</span> <span style="font-weight:700">${esc(item.cookTime)} хв</span></div>`:''}
          ${item.cookTimeBusy?`<div style="font-size:11px"><span style="color:var(--text-dim)">⏱ При навантаженні:</span> <span style="font-weight:700;color:var(--warning)">${esc(item.cookTimeBusy)} хв</span></div>`:''}
        </div>
        ${item.allergens&&item.allergens.length?`
          <div style="margin-bottom:12px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Алергени</div>
            ${item.allergens.map(a=>`<span class="allergen-tag">${esc(a)}</span>`).join('')}
          </div>`:''}
      </div>
      <div class="modal-footer" style="flex-wrap:wrap;padding:16px 20px calc(16px + env(safe-area-inset-bottom,0px));margin:0;border-top:1px solid var(--gold-border)">
        ${canEdit?`<button class="btn btn-outline btn-sm" onclick="closeModal();Menu.openEditItem('${sectionKey}','${catEncoded}',${idx})">✏️ Редагувати</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Закрити</button>
      </div>
    </div>`);
  },

  openAddItem(sectionKey, catEncoded) {
    const sections = Menu.getSections();
    // Перевіряємо чи є хоч якась категорія у вибраному розділі
    const sec = sections.find(s => s.key === sectionKey);
    const needsNewCat = sec && sec.categories.length === 0 && ['season','banquet','lean'].includes(sectionKey);

    const secOpts = sections.map(s =>
      `<optgroup label="${s.label}">${s.categories.map(c=>
        `<option value="${s.key}::${encodeURIComponent(c)}" ${sectionKey===s.key&&catEncoded===encodeURIComponent(c)?'selected':''}>${c}</option>`
      ).join('')}${s.key===sectionKey && needsNewCat ? `<option value="${sectionKey}::__new__" selected>+ Нова категорія...</option>` : ''}</optgroup>`
    ).join('');

    showModal(Menu.itemFormHTML(null, sectionKey, catEncoded, secOpts, undefined, needsNewCat));
  },

  _onCatSelectChange(sel) {
    const wrap = $('item-new-cat-wrap');
    if (!wrap) return;
    wrap.style.display = sel.value.endsWith('::__new__') ? 'block' : 'none';
  },

  openEditItem(sectionKey, catEncoded, idx) {
    const cat = decodeURIComponent(catEncoded);
    const item = Menu.getItems(sectionKey, cat)[idx];
    const sections = Menu.getSections();
    const secOpts = sections.map(s =>
      `<optgroup label="${s.label}">${s.categories.map(c=>
        `<option value="${s.key}::${encodeURIComponent(c)}" ${sectionKey===s.key&&catEncoded===encodeURIComponent(c)?'selected':''}>${c}</option>`
      ).join('')}</optgroup>`
    ).join('');

    showModal(Menu.itemFormHTML(item, sectionKey, catEncoded, secOpts, idx));
  },

  itemFormHTML(item, sectionKey, catEncoded, secOpts, editIdx, needsNewCat) {
    const isEdit = editIdx !== undefined;
    const allergenChecks = ALLERGENS.map(a => `
      <label style="display:inline-flex;align-items:center;gap:4px;margin:3px 6px 3px 0;font-size:11px;cursor:pointer">
        <input type="checkbox" value="${a}" ${item&&item.allergens&&item.allergens.includes(a)?'checked':''}> ${a}
      </label>`).join('');

    return `
      <div class="modal-title">${isEdit?'✏️ Редагувати':'＋ Нова позиція'}</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group">
          <label class="lbl">Розділ / Категорія</label>
          <select id="item-cat-select" class="field" onchange="Menu._onCatSelectChange(this)">${secOpts}</select>
        </div>
        <div id="item-new-cat-wrap" style="display:${needsNewCat?'block':'none'}">
          <div class="form-group">
            <label class="lbl">Назва нової категорії *</label>
            <input type="text" id="item-new-cat" class="field" placeholder="напр. Перші страви">
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Назва *</label>
          <input type="text" id="item-name" class="field" value="${item?item.name:''}" placeholder="Назва страви або напою">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="lbl">Ціна (₴)</label>
            <input type="number" id="item-price" class="field" value="${item?item.price||'':''}" placeholder="0">
          </div>
          <div class="form-group">
            <label class="lbl">Вага / Об'єм</label>
            <input type="text" id="item-weight" class="field" value="${item?item.weight||'':''}" placeholder="200г / 0.5л">
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Опис</label>
          <textarea id="item-desc" class="field" rows="3" style="resize:vertical" placeholder="Короткий опис страви...">${item?item.description||'':''}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="lbl">⏱ Час (без навант.) хв</label>
            <input type="number" id="item-time" class="field" value="${item?item.cookTime||'':''}" placeholder="15">
          </div>
          <div class="form-group">
            <label class="lbl">⏱ Час (при навант.) хв</label>
            <input type="number" id="item-time-busy" class="field" value="${item?item.cookTimeBusy||'':''}" placeholder="25">
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Фото страви</label>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" id="item-photo" class="field" value="${item?item.photo||'':''}" placeholder="https://... або завантажте з пристрою"
                oninput="Menu._previewPhoto(this.value)">
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <label class="btn btn-outline btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                <input type="file" id="item-photo-file" accept="image/*" style="display:none"
                  onchange="Menu._uploadItemPhoto(this)">
                📁 Завантажити з пристрою
              </label>
              <span id="item-photo-upload-status" style="font-size:11px;color:var(--text-dim)"></span>
            </div>
            <div id="item-photo-preview" style="margin-top:4px">
              ${item&&item.photo?`<img src="${item.photo}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)">`:''}
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Емодзі (якщо без фото)</label>
          <input type="text" id="item-emoji" class="field" value="${item?item.emoji||'':''}" placeholder="🥩">
        </div>
        <div class="form-group">
          <label class="lbl">Алергени</label>
          <div style="background:rgba(0,0,0,.2);border:1px solid var(--gold-border);border-radius:8px;padding:10px">${allergenChecks}</div>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit?`<button class="btn btn-danger btn-sm" onclick="Menu.deleteItem('${sectionKey}','${catEncoded}',${editIdx})">Видалити</button>`:''}
        <button class="btn btn-gold" onclick="Menu.saveItem('${sectionKey}','${catEncoded}',${isEdit?editIdx:'null'})">Зберегти</button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>`;
  },

  _previewPhoto(url) {
    const preview = $('item-photo-preview');
    if (!preview) return;
    preview.innerHTML = url
      ? `<img src="${url}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)" onerror="this.style.display='none'">`
      : '';
  },

  async _uploadItemPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const status = $('item-photo-upload-status');
    const label = input.closest('label');
    if (status) status.textContent = '⏳ Завантаження...';
    if (label) { label.style.opacity = '.5'; label.style.pointerEvents = 'none'; }
    try {
      const url = await uploadImageFile(file, 'images', 'menu');
      const photoInput = $('item-photo');
      if (photoInput) { photoInput.value = url; Menu._previewPhoto(url); }
      if (status) status.textContent = '✓ Завантажено';
    } catch(e) {
      console.error(e);
      toast('Помилка завантаження: ' + e.message, 'error');
      if (status) status.textContent = '';
    } finally {
      if (label) { label.style.opacity = ''; label.style.pointerEvents = ''; }
    }
  },

  saveItem(origSection, origCatEncoded, editIdx) {
    const name = $('item-name').value.trim();
    if (!name) { toast('Введіть назву', 'error'); return; }

    const catSelectVal = $('item-cat-select').value;
    const [newSection, newCatRaw] = catSelectVal.split('::');
    let newCat;
    if (newCatRaw === '__new__') {
      // Нова категорія — беремо з поля вводу
      newCat = ($('item-new-cat')?.value || '').trim();
      if (!newCat) { toast('Введіть назву категорії', 'error'); return; }
      // Додаємо категорію в розділ
      const customCats = DB.get(LS_KEYS.MENU_CUSTOM_CATS, {});
      if (!customCats[newSection]) customCats[newSection] = [];
      if (!customCats[newSection].includes(newCat)) customCats[newSection].push(newCat);
      DB.set(LS_KEYS.MENU_CUSTOM_CATS, customCats);
      // Одразу зберігаємо категорії в Supabase
      sb.upsert('settings', { key: LS_KEYS.MENU_CUSTOM_CATS, value: JSON.stringify(customCats) }, 'key')
        .catch(e => console.error('menu_sections_custom save error:', e));
    } else {
      newCat = decodeURIComponent(newCatRaw);
    }

    const allergens = [...document.querySelectorAll('#modal-content input[type=checkbox]:checked')].map(c=>c.value);

    const item = {
      name,
      price:       $('item-price').value.trim(),
      weight:      $('item-weight').value.trim(),
      description: $('item-desc').value.trim(),
      cookTime:    $('item-time').value.trim(),
      cookTimeBusy:$('item-time-busy').value.trim(),
      photo:       $('item-photo').value.trim(),
      emoji:       $('item-emoji').value.trim() || '🍽️',
      allergens,
      createdAt:   editIdx === null ? Date.now() : undefined,
    };

    if (editIdx !== null && editIdx !== undefined) {
      // Редагування — якщо категорія змінилась, переносимо
      const origCat = decodeURIComponent(origCatEncoded);
      const origItems = Menu.getItems(origSection, origCat);

      if (newSection === origSection && newCat === origCat) {
        origItems[editIdx] = { ...origItems[editIdx], ...item };
        Menu.saveItems(origSection, origCat, origItems);
      } else {
        // Перенести в іншу категорію
        origItems.splice(editIdx, 1);
        Menu.saveItems(origSection, origCat, origItems);
        const newItems = Menu.getItems(newSection, newCat);
        newItems.push({ ...item, createdAt: Date.now() });
        Menu.saveItems(newSection, newCat, newItems);
      }
    } else {
      const items = Menu.getItems(newSection, newCat);
      items.push({ ...item, createdAt: Date.now() });
      Menu.saveItems(newSection, newCat, items);
    }

    toast('Збережено!', 'success-t');
    closeModal();
    Menu.renderSection(newSection);
    menuActiveSection = newSection;
  },

  deleteItem(sectionKey, catEncoded, idx) {
    showConfirm('Видалити цю позицію з меню?', () => {
      const cat = decodeURIComponent(catEncoded);
      const items = Menu.getItems(sectionKey, cat);
      items.splice(idx, 1);
      Menu.saveItems(sectionKey, cat, items);
      toast('Видалено', 'success-t');
      Menu.renderSection(sectionKey);
    }, { okLabel: '🗑 Видалити' });
  },

  addWineCat() {
    const name = $('wine-cat-input').value.trim();
    if (!name) { toast('Введіть назву підрозділу', 'error'); return; }
    const cats = DB.get('menu_wine_cats', []);
    if (cats.includes(name)) { toast('Такий підрозділ вже є', 'error'); return; }
    cats.push(name);
    DB.set('menu_wine_cats', cats);
    sb.upsert('settings', { key: 'menu_wine_cats', value: JSON.stringify(cats) }, 'key')
      .catch(e => console.error('menu_wine_cats save error:', e));
    toast('Підрозділ додано', 'success-t');
    Menu.renderSection('wine');
  },

  // ── Синхронізація з ChoiceQR (тільки sysadmin) ──

  // Маппінг розділів ChoiceQR → вкладки порталу
  // url: slug у /online-menu/section:SLUG/...
  // catName: назва категорії у порталі
  // portalSection: ключ вкладки порталу (main/bar/wine/season/banquet/lean)
  CHOICEQR_SECTIONS: [
    { slug: 'menyu',          label: 'Меню',           portalSection: 'main',    catName: null },
    { slug: 'barne-menyu',    label: 'Барне меню',     portalSection: 'bar',     catName: null },
    { slug: 'vynna-karta',    label: 'Винна карта',    portalSection: 'wine',    catName: null },
    { slug: 'sezonne-menyu',  label: 'Сезонне меню',   portalSection: 'season',  catName: 'Сезонне меню' },
    { slug: 'banketne-menyu', label: 'Банкетне меню',  portalSection: 'banquet', catName: 'Банкетне меню' },
    { slug: 'bankete-menyu',  label: 'Банкетне меню',  portalSection: 'banquet', catName: 'Банкетне меню' },
    { slug: 'pisne-menyu',    label: 'Пісне меню',     portalSection: 'lean',    catName: 'Пісне меню' },
  ],

  openSyncModal() {
    if (!isSysadmin(currentUser)) { toast('Недостатньо прав', 'error'); return; }
    showModal(`
      <div class="modal-title">🔄 Синхронізація з ChoiceQR</div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:16px;line-height:1.6">
        Зчитує <b style="color:var(--text)">всі розділи</b> онлайн-меню з
        <span style="color:var(--gold)">tiflis374.choiceqr.com</span> та імпортує нові позиції
        у відповідні вкладки порталу. Вже існуючі страви <b style="color:var(--text)">не перезаписуються</b>.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;font-size:11px">
        <div style="background:rgba(0,0,0,.2);border:1px solid var(--gold-border);border-radius:8px;padding:10px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:6px">Розділи ChoiceQR</div>
          <div style="color:var(--text-dim);line-height:2">
            📋 Меню → <b style="color:var(--text)">Основне меню</b><br>
            🍸 Барне меню → <b style="color:var(--text)">Бар</b><br>
            🍷 Винна карта → <b style="color:var(--text)">Винна карта</b><br>
            🌿 Сезонне меню → <b style="color:var(--text)">Сезонне меню</b><br>
            🎉 Банкетне меню → <b style="color:var(--text)">Банкетне меню</b>
          </div>
        </div>
        <div style="background:rgba(0,0,0,.2);border:1px solid var(--gold-border);border-radius:8px;padding:10px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:6px">Що синхронізується</div>
          <div style="color:var(--text-dim);line-height:2">
            ✅ Назва страви<br>
            ✅ Ціна<br>
            ✅ Фото<br>
            ✅ Вага<br>
            ✅ Категорія
          </div>
        </div>
      </div>
      <div id="sync-status" style="display:none;padding:12px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid var(--gold-border);margin-bottom:16px;font-size:12px;line-height:2;max-height:260px;overflow-y:auto"></div>
      <div class="modal-footer">
        <button class="btn btn-gold" id="sync-start-btn" onclick="Menu.runSync()">🔄 Почати синхронізацію</button>
        <button class="btn btn-ghost" onclick="closeModal()">Закрити</button>
      </div>`);
  },

  // Список проксі — перебираємо по черзі поки один не спрацює
  PROXIES: [
    // Прямий fetch (якщо ChoiceQR дозволяє CORS)
    { type: 'direct' },
    // allorigins — найпопулярніший
    { type: 'allorigins', base: 'https://api.allorigins.win/get?url=' },
    // corsproxy.io
    { type: 'corsproxy', base: 'https://corsproxy.io/?' },
    // htmldriven
    { type: 'htmldriven', base: 'https://cors-anywhere.herokuapp.com/' },
  ],

  async runSync() {
    if (!isSysadmin(currentUser)) return;
    const btn = $('sync-start-btn');
    const statusEl = $('sync-status');
    btn.disabled = true;
    btn.textContent = '⏳ Завантаження...';
    statusEl.style.display = 'block';
    statusEl.innerHTML = '';

    const BASE = 'https://tiflis374.choiceqr.com/online-menu';

    const log = (msg) => {
      statusEl.innerHTML += msg + '<br>';
      statusEl.scrollTop = statusEl.scrollHeight;
    };

    let totalAdded = 0, totalSkipped = 0;
    const allParsed = { categories: {}, totalItems: 0, totalCats: 0 };

    try {
      // ── Крок 1: знайти робочий проксі ──
      log('⏳ Пошук з\'єднання...');
      const workingProxy = await Menu._findWorkingProxy(BASE, log);
      if (!workingProxy) {
        // Жоден проксі не спрацював — показати ручний режим
        Menu._showManualImport(btn, statusEl);
        return;
      }
      log(`✅ З\'єднання встановлено.`);

      // ── Крок 2: знайти розділи ──
      log('⏳ Завантаження головної сторінки меню...');
      const mainHtml = await Menu._fetchVia(workingProxy, BASE);
      const sectionUrls = Menu._extractSectionUrls(mainHtml, BASE);
      log(`📂 Знайдено розділів: <b>${sectionUrls.length}</b>`);

      // ── Крок 3: обійти кожен розділ ──
      for (const sec of sectionUrls) {
        log(`⏳ <span style="color:var(--gold)">${sec.label}</span>...`);
        try {
          const html = await Menu._fetchVia(workingProxy, sec.url);
          const parsed = Menu._parseChoiceQRPage(html, sec);
          log(`&nbsp;&nbsp;📋 <b>${parsed.totalItems}</b> поз. у <b>${parsed.totalCats}</b> кат.`);
          for (const [key, items] of Object.entries(parsed.categories)) {
            if (!allParsed.categories[key]) { allParsed.categories[key] = []; allParsed.totalCats++; }
            allParsed.categories[key].push(...items);
            allParsed.totalItems += items.length;
          }
          await new Promise(r => setTimeout(r, 700));
        } catch(e) {
          log(`&nbsp;&nbsp;⚠️ ${e.message}`);
        }
      }

      // ── Крок 4: імпорт ──
      log(`<br>💾 Імпорт...`);
      const { added, skipped } = await Menu._importParsed(allParsed);
      totalAdded = added; totalSkipped = skipped;
      log(`✅ Додано: <b style="color:var(--success)">${totalAdded}</b> &nbsp; Пропущено: <b style="color:var(--text-dim)">${totalSkipped}</b>`);

      if (totalAdded > 0) {
        try {
          await sb.upsert('settings', { key: 'menu_items', value: JSON.stringify(DB.get('menu_items', {})) }, 'key');
          log('💾 Збережено в базу.');
        } catch(e) { log('⚠️ Supabase недоступний — дані збережено локально.'); }
      }

      btn.textContent = '✅ Готово';
      toast(`Синхронізація: +${totalAdded} страв`, 'success-t');
      Menu.renderSection(menuActiveSection);

    } catch(e) {
      log(`❌ ${e.message}`);
      // Якщо будь-яка мережева помилка — пропонуємо ручний режим
      if (/fetch|network|cors|failed/i.test(e.message)) {
        Menu._showManualImport(btn, statusEl);
      } else {
        btn.textContent = '🔄 Спробувати ще раз';
        btn.disabled = false;
      }
      console.error(e);
    }
  },

  // Пробує проксі по черзі, повертає перший що спрацював
  async _findWorkingProxy(testUrl, log) {
    const PROXIES = [
      { type: 'direct' },
      { type: 'allorigins',  base: 'https://api.allorigins.win/get?url=' },
      { type: 'corsproxy',   base: 'https://corsproxy.io/?' },
      { type: 'jsonp',       base: 'https://api.codetabs.com/v1/proxy?quest=' },
    ];
    for (const proxy of PROXIES) {
      try {
        const html = await Menu._fetchVia(proxy, testUrl, 6000);
        if (html && html.length > 200) return proxy;
      } catch(e) { /* continue */ }
    }
    return null;
  },

  async _fetchVia(proxy, url, timeout = 15000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      let res, text;
      if (proxy.type === 'direct') {
        res = await fetch(url, { signal: ctrl.signal, mode: 'cors' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        text = await res.text();
      } else if (proxy.type === 'allorigins') {
        res = await fetch(proxy.base + encodeURIComponent(url), { signal: ctrl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.contents) throw new Error('empty');
        text = data.contents;
      } else {
        // corsproxy, jsonp — прямий текст
        res = await fetch(proxy.base + encodeURIComponent(url), { signal: ctrl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        text = await res.text();
      }
      if (!text || text.includes('Host not in allowlist') || text.includes('blocked')) throw new Error('blocked');
      return text;
    } finally {
      clearTimeout(tid);
    }
  },

  // Ручний режим — вставити текст зі сторінки
  _showManualImport(btn, statusEl) {
    statusEl.innerHTML += `
      <div style="margin-top:12px;padding:12px;background:rgba(224,160,80,.08);border:1px solid rgba(224,160,80,.3);border-radius:8px">
        <div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:8px">⚠️ Автоматичне з'єднання заблоковано</div>
        <div style="font-size:11px;color:var(--text-dim);line-height:1.7;margin-bottom:10px">
          Відкрийте <a href="https://tiflis374.choiceqr.com/online-menu" target="_blank" style="color:var(--gold)">tiflis374.choiceqr.com/online-menu</a>,
          виділіть весь текст сторінки (<b>Ctrl+A → Ctrl+C</b>), вставте сюди:
        </div>
        <textarea id="manual-import-text" class="field" rows="5" style="font-size:11px;resize:vertical"
          placeholder="Вставте текст сторінки тут..."></textarea>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-gold btn-sm" onclick="Menu.runManualImport()">📥 Імпортувати текст</button>
          <select id="manual-import-section" class="field" style="max-width:180px;padding:6px 10px;font-size:11px">
            <option value="main">🍽️ Основне меню</option>
            <option value="bar">🍸 Барне меню</option>
            <option value="wine">🍷 Винна карта</option>
            <option value="season">🌿 Сезонне меню</option>
            <option value="banquet">🎉 Банкетне меню</option>
            <option value="lean">🕊️ Пісне меню</option>
          </select>
        </div>
      </div>`;
    btn.textContent = '🔄 Спробувати ще раз';
    btn.disabled = false;
  },

  // Імпорт із вставленого тексту (ручний режим)
  async runManualImport() {
    const text = $('manual-import-text')?.value.trim();
    const sectionKey = $('manual-import-section')?.value || 'main';
    if (!text) { toast('Вставте текст спочатку', 'error'); return; }

    const secInfo = { portalSection: sectionKey, catName: null, label: sectionKey, slug: sectionKey };
    // Парсимо як plain-text
    const fakeHtml = `<body><pre>${text}</pre></body>`;
// ══════════════════════════════════════════
    const parsed = Menu._parseChoiceQRPage(fakeHtml, secInfo);

    const statusEl = $('sync-status');
    const log = (m) => { statusEl.innerHTML += m + '<br>'; statusEl.scrollTop = statusEl.scrollHeight; };

    if (parsed.totalItems === 0) { log('⚠️ Страви не знайдені. Перевірте чи скопійовано текст з меню.'); return; }

    log(`📋 Знайдено: <b>${parsed.totalItems}</b> позицій`);
    const { added, skipped } = await Menu._importParsed(parsed);
    log(`✅ Додано: <b style="color:var(--success)">${added}</b> &nbsp; Пропущено: <b style="color:var(--text-dim)">${skipped}</b>`);

    if (added > 0) {
      try {
        await sb.upsert('settings', { key: 'menu_items', value: JSON.stringify(DB.get('menu_items', {})) }, 'key');
        log('💾 Збережено.');
      } catch(e) {}
      logEvent('menu', `Додано ${added} страв з імпорту`); toast(`+${added} страв додано`, 'success-t');
      Menu.renderSection(menuActiveSection);
    }
  },

  // Витягнути URL всіх розділів меню з HTML головної сторінки
  _extractSectionUrls(html, base) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const found = [];
    const seen = new Set();

    // Шукаємо посилання виду /online-menu/section:SLUG/SLUG-ID
    const links = [...doc.querySelectorAll('a[href]')];
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/online-menu\/section:([^/]+)\/([^/?#]+)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        const slug = match[1];
        const label = a.textContent.trim() || slug;
        // Маппінг slug → вкладка порталу
        const portalSec = Menu._slugToPortal(slug);
        found.push({
          url: 'https://tiflis374.choiceqr.com' + href,
          slug,
          label: label || slug,
          portalSection: portalSec.portalSection,
          catName: portalSec.catName,
        });
      }
    });

    // Якщо посилань не знайшли — fallback на відомі slug'и
    if (found.length === 0) {
      const KNOWN = [
        { slug: 'menyu',         label: 'Меню' },
        { slug: 'barne-menyu',   label: 'Барне меню' },
        { slug: 'vynna-karta',   label: 'Винна карта' },
        { slug: 'sezonne-menyu', label: 'Сезонне меню' },
        { slug: 'banketne-menyu',label: 'Банкетне меню' },
      ];
      KNOWN.forEach(k => {
        const portalSec = Menu._slugToPortal(k.slug);
        found.push({
          url: `https://tiflis374.choiceqr.com/online-menu/section:${k.slug}/${k.slug}-835`,
          slug: k.slug, label: k.label,
          portalSection: portalSec.portalSection,
          catName: portalSec.catName,
        });
      });
    }

    return found;
  },

  _slugToPortal(slug) {
    const map = {
      'menyu':           { portalSection: 'main',    catName: null },
      'barne-menyu':     { portalSection: 'bar',     catName: null },
      'vynna-karta':     { portalSection: 'wine',    catName: null },
      'sezonne-menyu':   { portalSection: 'season',  catName: 'Сезонне меню' },
      'banketne-menyu':  { portalSection: 'banquet', catName: 'Банкетне меню' },
      'bankete-menyu':   { portalSection: 'banquet', catName: 'Банкетне меню' },
      'pisne-menyu':     { portalSection: 'lean',    catName: 'Пісне меню' },
    };
    // Часткове співпадіння
    for (const [key, val] of Object.entries(map)) {
      if (slug.includes(key) || key.includes(slug)) return val;
    }
    if (/bar|бар/.test(slug))     return { portalSection: 'bar',     catName: null };
    if (/vin|вин/.test(slug))     return { portalSection: 'wine',    catName: null };
    if (/sez|сез/.test(slug))     return { portalSection: 'season',  catName: 'Сезонне меню' };
    if (/bank|банк/.test(slug))   return { portalSection: 'banquet', catName: 'Банкетне меню' };
    if (/pis|піс|lean/.test(slug))return { portalSection: 'lean',    catName: 'Пісне меню' };
    return { portalSection: 'main', catName: null };
  },

  // Парсинг однієї сторінки розділу ChoiceQR
  _parseChoiceQRPage(html, secInfo) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = {};
    let totalItems = 0, totalCats = 0;

    // ChoiceQR рендерить контент через Next.js — дані зазвичай в тексті як plaintext блоки
    // Структура (з реального парсингу): рядки "НАЗВА КАТЕГОРІЇ" → картки "Назва\nЦіна ₴\nВага"
    // Спробуємо кілька стратегій

    const items = [];

    // Стратегія А: шукаємо картки товарів за типовими класами ChoiceQR
    const choiceSelectors = [
      '[class*="ProductCard"]','[class*="product-card"]','[class*="MenuCard"]',
      '[class*="DishCard"]','[class*="ItemCard"]','[class*="FoodCard"]',
      '[class*="menu-product"]','[class*="catalog-item"]',
    ];
    let cards = [];
    for (const sel of choiceSelectors) {
      cards = [...doc.querySelectorAll(sel)];
      if (cards.length >= 2) break;
    }

    // Стратегія Б: шукаємо li або article що містять ціну
    if (cards.length < 2) {
      cards = [...doc.querySelectorAll('li, article, [class*="item"], [class*="card"]')]
        .filter(el => {
          const txt = el.textContent;
          return (txt.includes('₴') || txt.includes('грн')) &&
                 el.textContent.trim().length < 500 &&
                 el.children.length >= 1 && el.children.length <= 15;
        });
      cards = cards.filter(el => !cards.some(o => o !== el && el.contains(o)));
    }

    // Стратегія В: plain-text парсинг (ChoiceQR SSR рендерить товари як блоки тексту)
    if (cards.length < 2) {
      // Шукаємо всі текстові вузли що виглядають як "Назва\nЦіна ₴"
      const bodyText = doc.body?.innerText || doc.body?.textContent || '';
      const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

      let currentCat = secInfo.catName || 'Загальне';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Ціна на наступному рядку після назви
        const nextLine = lines[i+1] || '';
        const priceMatch = nextLine.match(/^(\d[\d\s.,]*)\s*₴/) || line.match(/(\d[\d\s.,]*)\s*₴/);

        // Виявляємо назви категорій: рядок ВЕЛИКИМИ ЛІТЕРАМИ або дуже короткий без ціни
        if (line === line.toUpperCase() && line.length > 3 && line.length < 60 && !priceMatch) {
          // Це може бути заголовок категорії
          const cleaned = line.replace(/[^\wА-ЯҐЄІЇа-яґєії\s'-]/g,'').trim();
          if (cleaned.length > 2) currentCat = cleaned.length > 1
            ? cleaned.charAt(0) + cleaned.slice(1).toLowerCase()
            : cleaned;
          continue;
        }

        if (priceMatch && line.length >= 3 && line.length <= 120 && !/^\d/.test(line)) {
          const price = priceMatch[1].replace(/\s/g,'');
          const weightMatch = (lines[i+1]||'').match(/^(\d+)\s*(г|мл|кг|л)\b/i) ||
                              line.match(/(\d+)\s*(г|мл|кг|л)\b/i);
          items.push({
            name: line.replace(/\s*\d[\d\s.,]*\s*₴.*/, '').trim(),
            price,
            photo: '',
            weight: weightMatch ? weightMatch[0].trim() : '',
            description: '',
            category: currentCat,
            sectionKey: secInfo.portalSection,
          });
        }
      }
    }

    // Стратегія Г: парсинг DOM-карток (якщо знайшли картки)
    cards.forEach(card => {
      const allText = card.textContent.trim();
      if (!allText || allText.length > 600) return;

      // Назва: перший текстовий вузол або елемент з class name/title
      const nameEl = card.querySelector('[class*="name" i],[class*="title" i],h2,h3,h4,h5,strong,b') ||
                     [...card.querySelectorAll('*')].find(el =>
                       el.children.length === 0 && el.textContent.trim().length > 2 &&
                       el.textContent.trim().length < 100);
      const name = nameEl ? nameEl.textContent.trim() : allText.split('\n')[0].trim();
      if (!name || name.length < 2 || name.length > 120) return;

      const priceMatch = allText.match(/(\d[\d\s.,]*)\s*₴/);
      const price = priceMatch ? priceMatch[1].replace(/\s/g,'') : '';

      const img = card.querySelector('img');
      const photo = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';

      const weightMatch = allText.match(/(\d+)\s*(г|мл|кг|л)\b/i);
      const weight = weightMatch ? weightMatch[0].trim() : '';

      // Категорія: шукаємо найближчий заголовок вгору
      let cat = secInfo.catName || 'Загальне';
      let node = card.parentElement;
      outer: while (node && node.tagName !== 'BODY') {
        let prev = card.previousElementSibling;
        while (prev) {
          if (/^H[1-5]$/i.test(prev.tagName)) { cat = prev.textContent.trim(); break outer; }
          prev = prev.previousElementSibling;
        }
        const heading = node.querySelector('h1,h2,h3,[class*="category-title"],[class*="section-title"]');
        if (heading && heading.textContent.trim()) { cat = heading.textContent.trim(); break; }
        node = node.parentElement;
      }

      items.push({ name, price, photo: photo.startsWith('http') ? photo : '', weight, description: '', category: cat, sectionKey: secInfo.portalSection });
    });

    // Дедублікація по імені
    const seen = new Set();
    const unique = items.filter(it => {
      const k = it.name.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // Групуємо
    unique.forEach(item => {
      const key = item.sectionKey + '::' + item.category;
      if (!result[key]) { result[key] = []; totalCats++; }
      result[key].push(item);
      totalItems++;
    });

    return { categories: result, totalItems, totalCats };
  },

  async _importParsed(parsed) {
    const allItems = DB.get('menu_items', {});
    let added = 0, skipped = 0;

    for (const key of Object.keys(parsed.categories)) {
      const [sectionKey, catName] = key.split('::');
      const sec = MENU_SECTIONS.find(s => s.key === sectionKey);
      if (!sec) continue;

      // Для fixed-секцій НЕ мутуємо масив констант — категорія просто додасться до items
      if (sectionKey === 'wine') {
        const wineCats = DB.get('menu_wine_cats', []);
        if (!wineCats.includes(catName)) { wineCats.push(catName); DB.set('menu_wine_cats', wineCats); }
      }
      // Для season/banquet/lean — зберігаємо категорії в customCats (DB), не в MENU_SECTIONS
      if (['season','banquet','lean'].includes(sectionKey)) {
        const customCats = DB.get(LS_KEYS.MENU_CUSTOM_CATS, {});
        if (!customCats[sectionKey]) customCats[sectionKey] = [];
        if (!customCats[sectionKey].includes(catName)) {
          customCats[sectionKey].push(catName);
          DB.set(LS_KEYS.MENU_CUSTOM_CATS, customCats);
          try { localStorage.setItem(LS_KEYS.MENU_CUSTOM_CATS, JSON.stringify(customCats)); } catch(e) {}
        }
      }
    }

    for (const [key, newItems] of Object.entries(parsed.categories)) {
      const [sectionKey] = key.split('::');
      const sec = MENU_SECTIONS.find(s => s.key === sectionKey);
      if (!sec) continue;

      const existing = allItems[key] || [];
      const existingNames = new Set(existing.map(i => i.name.toLowerCase().trim()));

      for (const item of newItems) {
        const nameLow = item.name.toLowerCase().trim();
        if (existingNames.has(nameLow)) { skipped++; continue; }
        existing.push({
          name: item.name, price: item.price, photo: item.photo,
          weight: item.weight, description: item.description,
          emoji: '🍽️', allergens: [], cookTime: '', cookTimeBusy: '',
          createdAt: Date.now(), syncedFrom: 'choiceqr',
        });
        existingNames.add(nameLow);
        added++;
      }
      allItems[key] = existing;
    }

    DB.set('menu_items', allItems);
    return { added, skipped };
  },
};

