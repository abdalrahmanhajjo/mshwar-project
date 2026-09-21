import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type BrowseKey =
  | "heroTitle"
  | "heroBody"
  | "where"
  | "wherePlaceholder"
  | "when"
  | "whenPlaceholder"
  | "company"
  | "findPlace"
  | "lessSearching"
  | "perfectDay"
  | "goodDays"
  | "exploreAll"
  | "onePlanKicker"
  | "onePlanTitle"
  | "onePlanBody"
  | "onePlanPoint1"
  | "onePlanPoint2"
  | "onePlanPoint3"
  | "buildTrip"
  | "closeToHome"
  | "findPlaceCta"
  | "yallaTitle"
  | "destinationsEyebrow"
  | "destinationsTitle"
  | "destinationsBody"
  | "destinationsNote"
  | "destinationIntroKicker"
  | "destinationIntroTitle"
  | "planVisit"
  | "hoursAccess"
  | "openMaps"
  | "makeADay"
  | "startPlan"
  | "oneStop"
  | "oneStopBody"
  | "browseEyebrow"
  | "browseTitle"
  | "browseBody"
  | "searchExperiences"
  | "anywhere"
  | "filters"
  | "placesCount"
  | "recommended"
  | "cantDecide"
  | "cantDecideBody"
  | "planMyTrip"
  | "saveExperience"
  | "savedExperience"
  | "seeArea"
  | "estimatedFrom"
  | "perPerson"
  | "chooseDate"
  | "guests"
  | "estimatedTotal"
  | "preview"
  | "addToDayPlan"
  | "keepExploring"
  | "noReviews"
  | "sampleOffer"
  | "ideasEyebrow"
  | "ideasTitle"
  | "ideasBody"
  | "planDayHere"
  | "exploreDay"
  | "fromPrice"
  | "onRequest"
  | "free"
  | "hoursLabel"
  | "clearFilters"
  | "sortRecommended"
  | "sortPrice"
  | "sortDuration"
  | "emptyResults"
  | "forBusinesses"
  | "notifications"
  | "planATrip"
  | "myTrips"
  | "destinations"
  | "experiences"
  | "ideas"
  | "footerPace"
  | "exploreLebanon"
  | "partnerWithUs"
  | "tripIdeas"
  | "aboutMshwar"
  | "helpCenter"
  | "allPages"
  | "photoCredits"
  | "sampleDisclaimer"
  | "backDestinations"
  | "backExperiences"
  | "previewNote"
  | "kindAll"
  | "kindExperiences"
  | "kindAttractions"
  | "kindRestaurants"
  | "filterDate"
  | "filterPrice"
  | "filterDistance"
  | "filterGroup"
  | "filterRating"
  | "priceAny"
  | "distanceAny"
  | "anyRating"
  | "availableOnly"
  | "availabilityUnknown"
  | "policies"
  | "sortRating"
  | "pagePrevious"
  | "pageNext"
  | "discoverTitle"
  | "discoverBody"
  | "savedTitle"
  | "savedEmpty"
  | "quoteRequired"
  | "availabilityStatus"
  | "fromBeirut"
  | "mapView"
  | "listView"
  | "searchThisArea"
  | "mapUnavailable"
  | "clusterLabel"
  | "collectionsEyebrow"
  | "collectionsTitle"
  | "collectionsBody"
  | "openAsTrip"
  | "minutesLabel"
  | "nearbyTitle"
  | "placesOne"
  | "placesOther"
  | "yallaKicker"
  | "operations"
  | "heroKicker"
  | "heroCta"
  | "heroCaption"
  | "lessSearchingNote"
  | "perfectDayKicker"
  | "goodDaysKicker"
  | "closeToHomeKicker"
  | "illustrativePrices"
  | "onePlanCardKicker"
  | "onePlanCardNote"
  | "onePlanStep1"
  | "onePlanStep2"
  | "onePlanStep3"
  | "onePlanDetail1"
  | "onePlanDetail2"
  | "onePlanDetail3"
  | "viewDestination"
  | "experiencesInPlace"
  | "resultsSort"
  | "viewToggle"
  | "whatToExpect"
  | "theExperience"
  | "makeADayKicker"
  | "closerTitle"
  | "noChargeNote"
  | "stopsLabel"
  | "savedKicker"
  | "collectionsKicker"
  | "atYourOwnPace"
  | "sampleExperience"
  | "tagsLabel"
  | "bookingPanelTitle"
  | "resultsTitle"
  | "ideasStops"
  | "savedBody"
  | "galleryLabel"
  | "ratingLabel"
  | "goodDayTitle"
  | "fewThingsToKnow"
  | "travellerReviews"
  | "peopleLabel"
  | "personLabel";

export const browseCopy: Record<Locale, Record<BrowseKey, string>> = {
  en: {
    heroTitle: "Make room for a little mshwar.",
    heroBody: "From the mountain air to the sea, find your next day at your own pace.",
    where: "Where",
    wherePlaceholder: "Anywhere in Lebanon",
    when: "When",
    whenPlaceholder: "Choose a date",
    company: "Good company",
    findPlace: "Find my next place",
    lessSearching: "Less searching. More living.",
    perfectDay: "What does your perfect day look like?",
    goodDays: "Good days start here.",
    exploreAll: "Explore all experiences",
    onePlanKicker: "A few ideas. One great plan.",
    onePlanTitle: "One great plan.",
    onePlanBody: "Tell us your dates, your budget, and a little about the day. We will help you connect the dots.",
    onePlanPoint1: "A little mountain air",
    onePlanPoint2: "Something local for lunch",
    onePlanPoint3: "End where the sea begins",
    buildTrip: "Build my trip",
    closeToHome: "Close to home. Far from ordinary.",
    findPlaceCta: "Find your place",
    yallaTitle: "The best plans start with “yalla.”",
    destinationsEyebrow: "Six places. A thousand ways to go.",
    destinationsTitle: "Where will you wander?",
    destinationsBody: "Start with a place, then make the day your own.",
    destinationsNote:
      "Our starting cover is six destinations. More regions and verified local partners will be added as the marketplace grows.",
    destinationIntroKicker: "A place to start",
    destinationIntroTitle: "Leave a little room for discovery.",
    planVisit: "Plan your visit",
    hoursAccess: "Hours, access and weather need checking before travel.",
    openMaps: "Open area in Google Maps",
    makeADay: "Make a day of",
    startPlan: "Start my plan",
    oneStop: "One stop is just the beginning.",
    oneStopBody: "Add this place to a plan and build around it.",
    browseEyebrow: "Find your kind of somewhere",
    browseTitle: "A whole country. Your next discovery.",
    browseBody: "Big adventures, little escapes, and everything in between.",
    searchExperiences: "Try Byblos, hiking, or the coast",
    anywhere: "Anywhere in Lebanon",
    filters: "Filters",
    placesCount: "places to make a day of it",
    recommended: "Recommended",
    cantDecide: "Can’t decide? Let’s make a plan.",
    cantDecideBody: "Bring your favorites together into a day that works for you.",
    planMyTrip: "Plan my trip",
    saveExperience: "Save experience",
    savedExperience: "Saved",
    seeArea: "See the area",
    estimatedFrom: "Estimated from",
    perPerson: "person",
    chooseDate: "Choose your date",
    guests: "Guests",
    estimatedTotal: "Estimated total",
    preview: "Preview",
    addToDayPlan: "Add to a full-day plan",
    keepExploring: "Keep exploring.",
    noReviews: "No verified traveller reviews yet. Reviews in this preview are private sample submissions.",
    sampleOffer:
      "This is a sample itinerary idea, not a verified supplier offer. The displayed price is illustrative and excludes transport unless stated. Live capacity, cancellation terms, accessibility details and included services must be confirmed before commercial checkout.",
    ideasEyebrow: "A head start on a good day",
    ideasTitle: "A little inspiration, ready to go.",
    ideasBody: "Sample collections you can adapt to your date, group and budget.",
    planDayHere: "Plan a day here",
    exploreDay: "Explore this day",
    fromPrice: "From",
    onRequest: "On request",
    free: "Free",
    hoursLabel: "hours",
    clearFilters: "Clear all",
    sortRecommended: "Recommended",
    sortPrice: "Price",
    sortDuration: "Duration",
    emptyResults: "Nothing matches these filters. Clear them and leave a little room.",
    forBusinesses: "For businesses",
    notifications: "Notifications",
    planATrip: "Plan a trip",
    myTrips: "My trips",
    destinations: "Destinations",
    experiences: "Experiences",
    ideas: "Ideas",
    footerPace: "Lebanon, at your own pace.",
    exploreLebanon: "Explore Lebanon",
    partnerWithUs: "Partner with us",
    tripIdeas: "Trip ideas",
    aboutMshwar: "About mshwar",
    helpCenter: "Help center",
    allPages: "All pages",
    photoCredits: "Photography credits",
    sampleDisclaimer: "Interactive preview · Sample offers · No live payments",
    backDestinations: "All destinations",
    backExperiences: "Back to experiences",
    previewNote: "Request to book · Preview",
    kindAll: "All",
    kindExperiences: "Experiences",
    kindAttractions: "Attractions",
    kindRestaurants: "Restaurants",
    filterDate: "Date",
    filterPrice: "Price",
    filterDistance: "Distance from Beirut",
    filterGroup: "Group size",
    filterRating: "Rating",
    priceAny: "Any price",
    distanceAny: "Any distance",
    anyRating: "Any rating",
    availableOnly: "Available where known",
    availabilityUnknown: "Availability unknown",
    policies: "Policies",
    sortRating: "Rating",
    pagePrevious: "Previous",
    pageNext: "Next",
    discoverTitle: "Find your kind of somewhere.",
    discoverBody: "Destinations, experiences, attractions, restaurants and a few ready-made days.",
    savedTitle: "Kept for a later trip.",
    savedEmpty: "Nothing saved yet. Heart a place while you browse.",
    quoteRequired: "Quote required",
    availabilityStatus: "Availability",
    fromBeirut: "from Beirut",
    mapView: "Map",
    listView: "List",
    searchThisArea: "Search this area",
    mapUnavailable:
      "Map is unavailable. Showing the list pins instead. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google Maps.",
    clusterLabel: "Cluster",
    collectionsEyebrow: "Ready-made days",
    collectionsTitle: "Collections",
    collectionsBody: "Assembled from published experiences. Paused inventory never appears here.",
    openAsTrip: "Open as a trip",
    minutesLabel: "min",
    nearbyTitle: "Nearby and related",
    placesOne: "{count} place to make a day of it",
    placesOther: "{count} places to make a day of it",
    yallaKicker: "Go somewhere that feels like you",
    operations: "Operations",
    heroKicker: "Small country. Endless possibilities.",
    heroCta: "Let’s plan something good",
    heroCaption: "Byblos, Mount Lebanon",
    lessSearchingNote: "Local places. Thoughtful plans. Your own pace.",
    perfectDayKicker: "Follow your curiosity",
    goodDaysKicker: "A little inspiration",
    closeToHomeKicker: "A different side of Lebanon",
    illustrativePrices: "* Illustrative prices. Availability is not live.",
    onePlanCardKicker: "Your next Sunday",
    onePlanCardNote: "An idea to make your own. Timing is illustrative.",
    onePlanStep1: "09:30 · A fresh start",
    onePlanStep2: "12:30 · Time to recharge",
    onePlanStep3: "16:00 · The scenic route",
    onePlanDetail1: "Ancient cedars. A slower pace.",
    onePlanDetail2: "A table worth staying at.",
    onePlanDetail3: "Leave the rush behind.",
    viewDestination: "View destination",
    experiencesInPlace: "experiences here",
    resultsSort: "Sort by",
    viewToggle: "View",
    whatToExpect: "What to expect",
    theExperience: "The experience",
    makeADayKicker: "Make a day of it",
    closerTitle: "A little closer.",
    noChargeNote: "No charge. No real reservation.",
    stopsLabel: "stops",
    savedKicker: "Saved for later",
    collectionsKicker: "Curated days",
    atYourOwnPace: "at your own pace.",
    sampleExperience: "Sample experience",
    tagsLabel: "Good to know",
    bookingPanelTitle: "Reserve your spot",
    resultsTitle: "Results",
    ideasStops: "stops planned",
    savedBody: "Everything you hearted while browsing, ready for your next plan.",
    galleryLabel: "Photos",
    ratingLabel: "Traveller rating",
    goodDayTitle: "A good day, at your own pace.",
    fewThingsToKnow: "A few things to know",
    travellerReviews: "Traveller reviews",
    peopleLabel: "people",
    personLabel: "person",
  },
  ar: {
    heroTitle: "اترك مساحة لمشوار صغير.",
    heroBody: "من هواء الجبل إلى البحر، ابحث عن يومك القادم على مهلك.",
    where: "أين",
    wherePlaceholder: "في أي مكان في لبنان",
    when: "متى",
    whenPlaceholder: "اختر تاريخاً",
    company: "رفقة طيبة",
    findPlace: "أجد مكاني التالي",
    lessSearching: "بحث أقل. عيش أكثر.",
    perfectDay: "كيف يبدو يومك المثالي؟",
    goodDays: "الأيام الجميلة تبدأ من هنا.",
    exploreAll: "استكشف كل التجارب",
    onePlanKicker: "أفكار قليلة. خطة واحدة.",
    onePlanTitle: "خطة واحدة ممتازة.",
    onePlanBody: "أخبرنا عن التواريخ والميزانية وقليل عن اليوم. نساعدك على ربط التفاصيل.",
    onePlanPoint1: "قليل من هواء الجبل",
    onePlanPoint2: "شيء محلي للغداء",
    onePlanPoint3: "ونهاية عند أول البحر",
    buildTrip: "ابنِ رحلتي",
    closeToHome: "قريب من البيت. بعيد عن العادي.",
    findPlaceCta: "اعثر على مكانك",
    yallaTitle: "أفضل الخطط تبدأ بـ «يلا».",
    destinationsEyebrow: "ستة أماكن. ألف طريقة للذهاب.",
    destinationsTitle: "إلى أين ستتجول؟",
    destinationsBody: "ابدأ بمكان، ثم اجعل اليوم لك.",
    destinationsNote: "غطاؤنا الأول ستة وجهات. ستُضاف مناطق وشركاء محليون موثّقون مع نمو السوق.",
    destinationIntroKicker: "مكان للبداية",
    destinationIntroTitle: "اترك مساحة صغيرة للاكتشاف.",
    planVisit: "خطّط لزيارتك",
    hoursAccess: "تحقق من الساعات والوصول والطقس قبل السفر.",
    openMaps: "افتح المنطقة في خرائط غوغل",
    makeADay: "اجعل يوماً في",
    startPlan: "ابدأ خطتي",
    oneStop: "محطة واحدة هي مجرد بداية.",
    oneStopBody: "أضف هذا المكان إلى خطة وابنِ حولها.",
    browseEyebrow: "اعثر على نوع مكانك",
    browseTitle: "بلد بأكمله. اكتشافك التالي.",
    browseBody: "مغامرات كبيرة، هروب صغير، وكل ما بينهما.",
    searchExperiences: "جرّب جبيل أو المشي أو الساحل",
    anywhere: "في أي مكان في لبنان",
    filters: "تصفية",
    placesCount: "أماكن لصنع يوم",
    recommended: "موصى به",
    cantDecide: "لا تستطيع القرار؟ لنضع خطة.",
    cantDecideBody: "اجمع مفضلاتك في يوم يناسبك.",
    planMyTrip: "خطّط لرحلتي",
    saveExperience: "حفظ التجربة",
    savedExperience: "محفوظة",
    seeArea: "شاهد المنطقة",
    estimatedFrom: "تقدير من",
    perPerson: "شخص",
    chooseDate: "اختر تاريخك",
    guests: "الضيوف",
    estimatedTotal: "المجموع التقديري",
    preview: "معاينة",
    addToDayPlan: "أضف إلى خطة يوم كامل",
    keepExploring: "تابع الاستكشاف.",
    noReviews: "لا مراجعات مسافرين موثّقة بعد. المراجعات في هذه المعاينة عيّنات خاصة.",
    sampleOffer:
      "هذه فكرة مسار عيّنة وليست عرض مورّد موثّق. السعر توضيحي ولا يشمل النقل ما لم يُذكر. يجب تأكيد السعة والإلغاء والوصول والخدمات قبل الدفع التجاري.",
    ideasEyebrow: "بداية جيدة ليوم جميل",
    ideasTitle: "قليل من الإلهام، جاهز للانطلاق.",
    ideasBody: "مجموعات عيّنة يمكن تعديلها حسب التاريخ والمجموعة والميزانية.",
    planDayHere: "خطّط يوماً هنا",
    exploreDay: "استكشف هذا اليوم",
    fromPrice: "من",
    onRequest: "عند الطلب",
    free: "مجاني",
    hoursLabel: "ساعات",
    clearFilters: "مسح الكل",
    sortRecommended: "موصى به",
    sortPrice: "السعر",
    sortDuration: "المدة",
    emptyResults: "لا شيء يطابق هذه التصفية. امسحها واترك مساحة.",
    forBusinesses: "للأعمال",
    notifications: "الإشعارات",
    planATrip: "خطّط لرحلة",
    myTrips: "رحلاتي",
    destinations: "الوجهات",
    experiences: "التجارب",
    ideas: "أفكار",
    footerPace: "لبنان، على مهلك.",
    exploreLebanon: "استكشف لبنان",
    partnerWithUs: "شارك معنا",
    tripIdeas: "أفكار رحلات",
    aboutMshwar: "عن مشوار",
    helpCenter: "مركز المساعدة",
    allPages: "كل الصفحات",
    photoCredits: "حقوق الصور",
    sampleDisclaimer: "معاينة تفاعلية · عروض عيّنة · لا مدفوعات حية",
    backDestinations: "كل الوجهات",
    backExperiences: "العودة إلى التجارب",
    previewNote: "طلب حجز · معاينة",
    kindAll: "الكل",
    kindExperiences: "تجارب",
    kindAttractions: "معالم",
    kindRestaurants: "مطاعم",
    filterDate: "التاريخ",
    filterPrice: "السعر",
    filterDistance: "المسافة من بيروت",
    filterGroup: "حجم المجموعة",
    filterRating: "التقييم",
    priceAny: "أي سعر",
    distanceAny: "أي مسافة",
    anyRating: "أي تقييم",
    availableOnly: "المتاح حيث يُعرف",
    availabilityUnknown: "التوفر غير معروف",
    policies: "السياسات",
    sortRating: "التقييم",
    pagePrevious: "السابق",
    pageNext: "التالي",
    discoverTitle: "اعثر على نوع مكانك.",
    discoverBody: "وجهات وتجارب ومعالم ومطاعم وأيام جاهزة.",
    savedTitle: "محفوظة لرحلة لاحقة.",
    savedEmpty: "لا شيء محفوظ بعد. احفظ مكاناً أثناء التصفح.",
    quoteRequired: "يتطلب عرض سعر",
    availabilityStatus: "التوفر",
    fromBeirut: "من بيروت",
    mapView: "خريطة",
    listView: "قائمة",
    searchThisArea: "ابحث في هذه المنطقة",
    mapUnavailable: "الخريطة غير متاحة. تُعرض الدبابيس في القائمة.",
    clusterLabel: "تجمّع",
    collectionsEyebrow: "أيام جاهزة",
    collectionsTitle: "مجموعات",
    collectionsBody: "مختارة من تجارب منشورة. المخزون المتوقف لا يظهر هنا.",
    openAsTrip: "افتح كرحلة",
    minutesLabel: "د",
    nearbyTitle: "قريب وذو صلة",
    placesOne: "مكان واحد لصنع يوم",
    placesOther: "{count} أماكن لصنع يوم",
    yallaKicker: "اذهب إلى مكان يشبهك",
    operations: "العمليات",
    heroKicker: "بلد صغير. احتمالات لا تنتهي.",
    heroCta: "لنخطّط لشيء جميل",
    heroCaption: "جبيل، جبل لبنان",
    lessSearchingNote: "أماكن محلية. خطط مدروسة. على مهلك.",
    perfectDayKicker: "اتبع فضولك",
    goodDaysKicker: "قليل من الإلهام",
    closeToHomeKicker: "وجه آخر للبنان",
    illustrativePrices: "* أسعار توضيحية. التوفر غير مباشر.",
    onePlanCardKicker: "أحدك القادم",
    onePlanCardNote: "فكرة لتجعلها لك. التوقيت توضيحي.",
    onePlanStep1: "09:30 · بداية منعشة",
    onePlanStep2: "12:30 · وقت لاستعادة النشاط",
    onePlanStep3: "16:00 · الطريق الأجمل",
    onePlanDetail1: "أرز عتيق. إيقاع أهدأ.",
    onePlanDetail2: "طاولة تستحق البقاء.",
    onePlanDetail3: "اترك العجلة خلفك.",
    viewDestination: "عرض الوجهة",
    experiencesInPlace: "تجارب هنا",
    resultsSort: "ترتيب حسب",
    viewToggle: "العرض",
    whatToExpect: "ماذا تتوقع",
    theExperience: "التجربة",
    makeADayKicker: "اجعله يوماً كاملاً",
    closerTitle: "أقرب قليلاً.",
    noChargeNote: "بلا رسوم. بلا حجز فعلي.",
    stopsLabel: "محطات",
    savedKicker: "محفوظ لوقت لاحق",
    collectionsKicker: "أيام منتقاة",
    atYourOwnPace: "على مهلك.",
    sampleExperience: "تجربة عيّنة",
    tagsLabel: "معلومات مفيدة",
    bookingPanelTitle: "احجز مكانك",
    resultsTitle: "النتائج",
    ideasStops: "محطات مخطّطة",
    savedBody: "كل ما أعجبك أثناء التصفح، جاهز لخطتك القادمة.",
    galleryLabel: "الصور",
    ratingLabel: "تقييم المسافرين",
    goodDayTitle: "يوم جميل، على مهلك.",
    fewThingsToKnow: "أمور ينبغي معرفتها",
    travellerReviews: "مراجعات المسافرين",
    peopleLabel: "أشخاص",
    personLabel: "شخص",
  },
  fr: {
    heroTitle: "Faites une place à un petit mshwar.",
    heroBody: "De l’air de la montagne à la mer, trouvez votre prochaine journée à votre rythme.",
    where: "Où",
    wherePlaceholder: "N’importe où au Liban",
    when: "Quand",
    whenPlaceholder: "Choisir une date",
    company: "Bonne compagnie",
    findPlace: "Trouver mon prochain lieu",
    lessSearching: "Moins chercher. Plus vivre.",
    perfectDay: "À quoi ressemble votre journée parfaite ?",
    goodDays: "Les beaux jours commencent ici.",
    exploreAll: "Voir toutes les expériences",
    onePlanKicker: "Quelques idées. Un grand plan.",
    onePlanTitle: "Un grand plan.",
    onePlanBody: "Donnez-nous vos dates, votre budget et un peu de la journée. Nous relions les points.",
    onePlanPoint1: "Un peu d’air de montagne",
    onePlanPoint2: "Quelque chose de local pour déjeuner",
    onePlanPoint3: "Finir là où la mer commence",
    buildTrip: "Construire mon voyage",
    closeToHome: "Près de chez soi. Loin de l’ordinaire.",
    findPlaceCta: "Trouver votre lieu",
    yallaTitle: "Les meilleurs plans commencent par « yalla ».",
    destinationsEyebrow: "Six lieux. Mille façons d’y aller.",
    destinationsTitle: "Où allez-vous flâner ?",
    destinationsBody: "Commencez par un lieu, puis faites de la journée la vôtre.",
    destinationsNote:
      "Notre couverture de départ : six destinations. D’autres régions et partenaires locaux vérifiés s’ajouteront.",
    destinationIntroKicker: "Un lieu pour commencer",
    destinationIntroTitle: "Laissez un peu de place à la découverte.",
    planVisit: "Préparer votre visite",
    hoursAccess: "Horaires, accès et météo à vérifier avant de partir.",
    openMaps: "Ouvrir la zone dans Google Maps",
    makeADay: "Faire une journée à",
    startPlan: "Commencer mon plan",
    oneStop: "Un arrêt n’est que le début.",
    oneStopBody: "Ajoutez ce lieu à un plan et construisez autour.",
    browseEyebrow: "Trouvez votre quelque part",
    browseTitle: "Tout un pays. Votre prochaine découverte.",
    browseBody: "Grandes aventures, petites échappées, et tout le reste.",
    searchExperiences: "Essayez Byblos, la randonnée ou la côte",
    anywhere: "N’importe où au Liban",
    filters: "Filtres",
    placesCount: "lieux pour en faire une journée",
    recommended: "Recommandé",
    cantDecide: "Vous hésitez ? Faisons un plan.",
    cantDecideBody: "Réunissez vos favoris en une journée qui vous convient.",
    planMyTrip: "Planifier mon voyage",
    saveExperience: "Enregistrer l’expérience",
    savedExperience: "Enregistrée",
    seeArea: "Voir la zone",
    estimatedFrom: "Estimé à partir de",
    perPerson: "personne",
    chooseDate: "Choisissez votre date",
    guests: "Invités",
    estimatedTotal: "Total estimé",
    preview: "Aperçu",
    addToDayPlan: "Ajouter à une journée complète",
    keepExploring: "Continuer à explorer.",
    noReviews: "Pas encore d’avis voyageurs vérifiés. Les avis de cet aperçu sont des exemples privés.",
    sampleOffer:
      "Ceci est une idée d’itinéraire, pas une offre fournisseur vérifiée. Le prix est illustratif et exclut le transport sauf mention. Capacité, annulation, accessibilité et services doivent être confirmés avant un paiement commercial.",
    ideasEyebrow: "Une longueur d’avance sur une belle journée",
    ideasTitle: "Un peu d’inspiration, prête à partir.",
    ideasBody: "Collections d’exemple à adapter à votre date, groupe et budget.",
    planDayHere: "Planifier une journée ici",
    exploreDay: "Explorer cette journée",
    fromPrice: "À partir de",
    onRequest: "Sur demande",
    free: "Gratuit",
    hoursLabel: "heures",
    clearFilters: "Tout effacer",
    sortRecommended: "Recommandé",
    sortPrice: "Prix",
    sortDuration: "Durée",
    emptyResults: "Aucun résultat pour ces filtres. Effacez-les et laissez un peu de place.",
    forBusinesses: "Pour les entreprises",
    notifications: "Notifications",
    planATrip: "Planifier un voyage",
    myTrips: "Mes voyages",
    destinations: "Destinations",
    experiences: "Expériences",
    ideas: "Idées",
    footerPace: "Le Liban, à votre rythme.",
    exploreLebanon: "Explorer le Liban",
    partnerWithUs: "Devenir partenaire",
    tripIdeas: "Idées de voyage",
    aboutMshwar: "À propos de mshwar",
    helpCenter: "Centre d’aide",
    allPages: "Toutes les pages",
    photoCredits: "Crédits photo",
    sampleDisclaimer: "Aperçu interactif · Offres d’exemple · Pas de paiements en direct",
    backDestinations: "Toutes les destinations",
    backExperiences: "Retour aux expériences",
    previewNote: "Demande de réservation · Aperçu",
    kindAll: "Tout",
    kindExperiences: "Expériences",
    kindAttractions: "Attractions",
    kindRestaurants: "Restaurants",
    filterDate: "Date",
    filterPrice: "Prix",
    filterDistance: "Distance depuis Beyrouth",
    filterGroup: "Taille du groupe",
    filterRating: "Note",
    priceAny: "Tous les prix",
    distanceAny: "Toute distance",
    anyRating: "Toutes les notes",
    availableOnly: "Disponible lorsque connu",
    availabilityUnknown: "Disponibilité inconnue",
    policies: "Politiques",
    sortRating: "Note",
    pagePrevious: "Précédent",
    pageNext: "Suivant",
    discoverTitle: "Trouvez votre quelque part.",
    discoverBody: "Destinations, expériences, attractions, restaurants et quelques journées prêtes.",
    savedTitle: "Gardé pour plus tard.",
    savedEmpty: "Rien d’enregistré. Ajoutez un lieu pendant que vous explorez.",
    quoteRequired: "Devis requis",
    availabilityStatus: "Disponibilité",
    fromBeirut: "depuis Beyrouth",
    mapView: "Carte",
    listView: "Liste",
    searchThisArea: "Chercher dans cette zone",
    mapUnavailable: "Carte indisponible. Les épingles s’affichent en liste.",
    clusterLabel: "Groupe",
    collectionsEyebrow: "Journées prêtes",
    collectionsTitle: "Collections",
    collectionsBody: "Assemblées à partir d’expériences publiées.",
    openAsTrip: "Ouvrir comme voyage",
    minutesLabel: "min",
    nearbyTitle: "À proximité et liés",
    placesOne: "{count} lieu pour en faire une journée",
    placesOther: "{count} lieux pour en faire une journée",
    yallaKicker: "Allez là où vous vous sentez vous-même",
    operations: "Opérations",
    heroKicker: "Petit pays. Possibilités infinies.",
    heroCta: "Préparons quelque chose de bien",
    heroCaption: "Byblos, Mont-Liban",
    lessSearchingNote: "Des lieux locaux. Des plans réfléchis. À votre rythme.",
    perfectDayKicker: "Suivez votre curiosité",
    goodDaysKicker: "Un peu d’inspiration",
    closeToHomeKicker: "Une autre facette du Liban",
    illustrativePrices: "* Prix indicatifs. Disponibilités non synchronisées.",
    onePlanCardKicker: "Votre prochain dimanche",
    onePlanCardNote: "Une idée à personnaliser. Horaires indicatifs.",
    onePlanStep1: "09:30 · Un départ en douceur",
    onePlanStep2: "12:30 · Le temps de souffler",
    onePlanStep3: "16:00 · La route panoramique",
    onePlanDetail1: "Cèdres millénaires. Un rythme plus lent.",
    onePlanDetail2: "Une table où l’on s’attarde.",
    onePlanDetail3: "Laissez la hâte derrière vous.",
    viewDestination: "Voir la destination",
    experiencesInPlace: "expériences ici",
    resultsSort: "Trier par",
    viewToggle: "Vue",
    whatToExpect: "À quoi s’attendre",
    theExperience: "L’expérience",
    makeADayKicker: "Faites-en une journée",
    closerTitle: "Un peu plus près.",
    noChargeNote: "Aucun débit. Aucune réservation réelle.",
    stopsLabel: "étapes",
    savedKicker: "Gardé pour plus tard",
    collectionsKicker: "Journées choisies",
    atYourOwnPace: "à votre rythme.",
    sampleExperience: "Expérience exemple",
    tagsLabel: "Bon à savoir",
    bookingPanelTitle: "Réservez votre place",
    resultsTitle: "Résultats",
    ideasStops: "étapes prévues",
    savedBody: "Tout ce que vous avez aimé en explorant, prêt pour votre prochain plan.",
    galleryLabel: "Photos",
    ratingLabel: "Note des voyageurs",
    goodDayTitle: "Une belle journée, à votre rythme.",
    fewThingsToKnow: "Quelques points à savoir",
    travellerReviews: "Avis des voyageurs",
    peopleLabel: "personnes",
    personLabel: "personne",
  },
};

export function useBrowseCopy() {
  const { locale } = useLocale();
  return browseCopy[locale];
}
