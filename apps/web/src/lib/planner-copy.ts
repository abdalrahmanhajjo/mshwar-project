import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type PlannerKey =
  | "startTitle"
  | "startHint"
  | "searchPlace"
  | "searchPlaceholder"
  | "dropPin"
  | "useLocation"
  | "locationDenied"
  | "manualEntry"
  | "saveStart"
  | "savedStart"
  | "precisePermission"
  | "mapFallback"
  | "planTitle"
  | "planHint"
  | "optimize"
  | "infeasible"
  | "metricsUnavailable"
  | "weatherWarning"
  | "noWarning"
  | "forecastUnavailable"
  | "replanAffected"
  | "replanNone"
  | "before"
  | "after"
  | "indoor"
  | "outdoor"
  | "weatherSensitive"
  | "thresholdsTitle"
  | "thresholdsHint"
  | "title"
  | "body"
  | "placeholder"
  | "build"
  | "clarify"
  | "assumptions"
  | "degraded"
  | "timeline"
  | "travel"
  | "cost"
  | "total"
  | "lock"
  | "unlock"
  | "regenerate"
  | "replace"
  | "accept"
  | "cancel"
  | "refine"
  | "apply"
  | "versions"
  | "sponsored"
  | "estimated"
  | "fromPrice"
  | "quote"
  | "why"
  | "booking"
  | "updateError"
  | "aiQuotaExceeded"
  | "aiCapacityReached"
  | "rateLimited"
  | "tripLabel"
  | "sealed"
  | "plannerKicker"
  | "pageTitle"
  | "pageBody"
  | "moodLabel"
  | "emptyKicker"
  | "emptyHeading"
  | "emptyTitle"
  | "emptyBody"
  | "takingShape"
  | "editableNote"
  | "savedPlanNote"
  | "noSavedPlan"
  | "flowStepOf"
  | "flowStepDestination"
  | "flowStepDetails"
  | "flowStepReview"
  | "flowChooseTitle"
  | "flowChooseHint"
  | "flowDetailsTitle"
  | "flowDetailsHint"
  | "flowDateLabel"
  | "flowPartyLabel"
  | "flowBudgetLabel"
  | "flowStrictLabel"
  | "flowVibeLabel"
  | "flowVibePlaceholder"
  | "flowBack"
  | "flowContinue"
  | "flowGenerate"
  | "flowGenerating"
  | "flowStartOver"
  | "flowReviewTitle"
  | "flowReviewHint"
  | "flowAdvancedTitle"
  | "flowAdvancedHint"
  | "flowOpenGroup"
  | "flowChangeDestination"
  | "flowNoDestinations"
  | "flowRegenerating"
  | "flowSelected"
  | "modeAi"
  | "modeManual"
  | "modeAiHint"
  | "modeManualHint"
  | "flowStepPlaces"
  | "flowPickTitle"
  | "flowPickHint"
  | "flowPickAdd"
  | "flowPickAdded"
  | "flowPickEmpty"
  | "flowSelectedCount"
  | "flowReorderHint"
  | "flowMoveUp"
  | "flowMoveDown"
  | "flowRemove"
  | "flowSave"
  | "flowSaving"
  | "flowYourDay"
  | "flowAddMore"
  | "flowManualNeedPicks"
  | "flowManualReviewHint"
  | "flowEditManual"
  | "flowNoOverlap"
  | "stopsLabel"
  | "estimateLabel"
  | "ofBudget"
  | "partyLabel"
  | "fineTune"
  | "fineTuneBody"
  | "previewAction"
  | "previewNote"
  | "suggestionsLabel"
  | "suggestion1"
  | "suggestion2"
  | "suggestion3"
  | "routeStart"
  | "replacementsTitle";

export const plannerCopy: Record<Locale, Record<PlannerKey, string>> = {
  en: {
    startTitle: "Where should this plan start?",
    startHint: "Search, drop a pin, or type a place. Device location is optional and never the only way in.",
    searchPlace: "Search a place",
    searchPlaceholder: "Hamra, Byblos, airport…",
    dropPin: "Drop a pin on the map",
    useLocation: "Use my location",
    locationDenied: "Location permission was denied. Search, pin, or type a place instead.",
    manualEntry: "Type a label and coordinates",
    saveStart: "Save as default start",
    savedStart: "Saved to your profile",
    precisePermission: "Precise location is requested only when you tap Use my location.",
    mapFallback: "Map tiles need a browser Maps key. The pin grid still works.",
    planTitle: "Route, weather and replan",
    planHint: "Travel times come from the routing service. Weather warnings never change bookings.",
    optimize: "Optimise stop order",
    infeasible: "No feasible plan honours locked stops, hours and return-by.",
    metricsUnavailable: "Travel time is unavailable from the routing provider. These are not estimates.",
    weatherWarning: "Weather warning",
    noWarning: "No weather warning for this plan.",
    forecastUnavailable: "Forecast unavailable — no warning shown.",
    replanAffected: "Rebuild weather-affected stops",
    replanNone: "No feasible alternative. The current plan was left unchanged.",
    before: "Before",
    after: "After",
    indoor: "Indoor",
    outdoor: "Outdoor",
    weatherSensitive: "Weather-sensitive",
    thresholdsTitle: "Weather warning thresholds",
    thresholdsHint: "Warnings name affected stops. They never cancel bookings.",
    title: "AI trip builder",
    body: "Describe a day in Arabic, Lebanese Arabic, English or French. Stops come from published inventory. Totals are summed from stored prices — the model never invents a place or a number.",
    placeholder: "A slow day in Byblos for two, or بدي يوم هادي بجبيل…",
    build: "Build plan",
    clarify: "Answer and continue",
    assumptions: "Assumed defaults",
    degraded: "Natural-language planning is unavailable. This plan used structured filters only.",
    timeline: "Timeline",
    travel: "Travel",
    cost: "Cost breakdown",
    total: "Plan total",
    lock: "Lock stop",
    unlock: "Unlock",
    regenerate: "Regenerate the rest",
    replace: "Replace this stop",
    accept: "Accept replacement",
    cancel: "Cancel",
    refine: "Ask for a change",
    apply: "Apply this change",
    versions: "Version history",
    sponsored: "Sponsored",
    estimated: "Estimated",
    fromPrice: "From",
    quote: "Quote required",
    why: "Why this stop",
    booking: "Booking",
    updateError: "Could not update the plan.",
    aiQuotaExceeded: "You've reached today's AI planning limit. It resets at midnight Beirut time.",
    aiCapacityReached: "AI planning is busy right now. Please try again later.",
    rateLimited: "You're going a little fast. Please wait a moment and try again.",
    tripLabel: "Trip {id}",
    sealed: "sealed",
    plannerKicker: "The Mshwar planner",
    pageTitle: "Your day. Your way.",
    pageBody: "A few details. A little inspiration. Something worth going out for.",
    moodLabel: "What are you in the mood for?",
    emptyKicker: "Room for something good",
    emptyHeading: "Where will the day take you?",
    emptyTitle: "Start with a feeling. We’ll help with the rest.",
    emptyBody: "Describe your day to explore a sample plan built from published places.",
    takingShape: "Your day is taking shape",
    editableNote: "Stop order is editable. Travel times, opening hours and availability still need live verification.",
    savedPlanNote: "This is your saved itinerary. Start a new plan or refine it to make changes.",
    noSavedPlan: "This trip has no saved plan yet. Describe your day below to generate one.",
    flowStepOf: "Step {n} of {total}",
    flowStepDestination: "Destination",
    flowStepDetails: "Details",
    flowStepReview: "Itinerary",
    flowChooseTitle: "Where do you want to go?",
    flowChooseHint: "Pick a destination and we'll build a real day plan from published places there.",
    flowDetailsTitle: "Trip details",
    flowDetailsHint: "A few basics so the plan fits your day. You can change everything later.",
    flowDateLabel: "Date",
    flowPartyLabel: "Group size",
    flowBudgetLabel: "Budget (USD)",
    flowStrictLabel: "Keep the plan within this budget",
    flowVibeLabel: "Anything specific? (optional)",
    flowVibePlaceholder: "e.g. relaxed pace, good food, sea views, family-friendly",
    flowBack: "Back",
    flowContinue: "Continue",
    flowGenerate: "Generate itinerary",
    flowGenerating: "Building your day…",
    flowStartOver: "Start over",
    flowReviewTitle: "Your itinerary",
    flowReviewHint: "Saved to My Trips automatically. Refine it, swap stops or fine-tune the route below.",
    flowAdvancedTitle: "Advanced tools",
    flowAdvancedHint: "Optimise the route, check the weather and plan with a group.",
    flowOpenGroup: "Plan with a group",
    flowChangeDestination: "Change",
    flowNoDestinations: "No destinations are available yet.",
    flowRegenerating: "Regenerating…",
    flowSelected: "Selected",
    modeAi: "Plan with AI",
    modeManual: "Build it myself",
    modeAiHint: "Tell us the vibe and we build the day.",
    modeManualHint: "Pick the places yourself and arrange the day.",
    flowStepPlaces: "Places",
    flowPickTitle: "Pick your places",
    flowPickHint: "Add real published places, then arrange them into your day.",
    flowPickAdd: "Add",
    flowPickAdded: "Added",
    flowPickEmpty: "No places are published for this destination yet.",
    flowSelectedCount: "{n} selected",
    flowReorderHint: "Use the arrows to set the order of your day.",
    flowMoveUp: "Move up",
    flowMoveDown: "Move down",
    flowRemove: "Remove",
    flowSave: "Save itinerary",
    flowSaving: "Saving…",
    flowYourDay: "Your day",
    flowAddMore: "Add more places",
    flowManualNeedPicks: "Add at least one place to continue.",
    flowManualReviewHint: "Saved to My Trips. Times are estimated from each place’s typical visit length.",
    flowEditManual: "Edit manually",
    flowNoOverlap: "Stops are scheduled back-to-back, so times never overlap.",
    stopsLabel: "stops",
    estimateLabel: "Your experience estimate",
    ofBudget: "of {budget} budget",
    partyLabel: "people",
    fineTune: "Fine-tune the route",
    fineTuneBody: "Set where the day starts, then optimise the stop order and check the weather.",
    previewAction: "Preview",
    previewNote:
      "Preview planner uses published inventory and stored prices. Live AI and route validation may be limited.",
    suggestionsLabel: "Try",
    suggestion1: "A slow day by the sea for two",
    suggestion2: "Cedars and a mountain lunch with family",
    suggestion3: "بدي يوم هادي بجبيل",
    routeStart: "Starting point",
    replacementsTitle: "Alternatives",
  },
  ar: {
    startTitle: "من أين تبدأ هذه الخطة؟",
    startHint: "ابحث أو أسقط دبوساً أو اكتب مكاناً. موقع الجهاز اختياري وليس الطريق الوحيد.",
    searchPlace: "ابحث عن مكان",
    searchPlaceholder: "الحمرا، جبيل، المطار…",
    dropPin: "أسقط دبوساً على الخريطة",
    useLocation: "استخدم موقعي",
    locationDenied: "رُفض إذن الموقع. استخدم البحث أو الدبوس أو الإدخال اليدوي.",
    manualEntry: "اكتب اسماً وإحداثيات",
    saveStart: "احفظ كنقطة انطلاق افتراضية",
    savedStart: "حُفظ في ملفك",
    precisePermission: "يُطلب الموقع الدقيق فقط عند الضغط على استخدم موقعي.",
    mapFallback: "بلاطات الخريطة تحتاج مفتاح متصفح. شبكة الدبابيس ما زالت تعمل.",
    planTitle: "المسار والطقس وإعادة التخطيط",
    planHint: "أوقات التنقل من خدمة التوجيه. تحذيرات الطقس لا تغيّر الحجوزات.",
    optimize: "حسّن ترتيب المحطات",
    infeasible: "لا توجد خطة ممكنة تحترم المحطات المقفلة والساعات ووقت العودة.",
    metricsUnavailable: "وقت التنقل غير متاح من المزود. هذه ليست تقديرات.",
    weatherWarning: "تحذير طقس",
    noWarning: "لا يوجد تحذير طقس لهذه الخطة.",
    forecastUnavailable: "التوقع غير متاح — لن يُعرض تحذير.",
    replanAffected: "أعد بناء المحطات المتأثرة بالطقس",
    replanNone: "لا بديل ممكن. بقيت الخطة الحالية كما هي.",
    before: "قبل",
    after: "بعد",
    indoor: "داخلي",
    outdoor: "خارجي",
    weatherSensitive: "حسّاس للطقس",
    thresholdsTitle: "عتبات تحذير الطقس",
    thresholdsHint: "التحذيرات تسمّي المحطات المتأثرة ولا تلغي الحجوزات.",
    title: "منشئ الرحلة",
    body: "صف يوماً بالعربية أو الإنكليزية أو الفرنسية. المحطات من المخزون المنشور. المجاميع تُحسب من الأسعار المخزّنة.",
    placeholder: "بدي يوم هادي بجبيل لشخصين…",
    build: "إنشاء الخطة",
    clarify: "أجب وتابع",
    assumptions: "افتراضات ظاهرة",
    degraded: "التخطيط باللغة الطبيعية غير متاح. استُخدمت عوامل التصفية المنظمة فقط.",
    timeline: "الجدول",
    travel: "الانتقال",
    cost: "تفصيل التكلفة",
    total: "مجموع الخطة",
    lock: "تثبيت المحطة",
    unlock: "إلغاء التثبيت",
    regenerate: "إعادة توليد الباقي",
    replace: "استبدال هذه المحطة",
    accept: "قبول البديل",
    cancel: "إلغاء",
    refine: "اطلب تغييراً",
    apply: "تطبيق التغيير",
    versions: "سجل النسخ",
    sponsored: "مدعوم",
    estimated: "تقديري",
    fromPrice: "ابتداءً من",
    quote: "يتطلب عرض سعر",
    why: "لماذا هذه المحطة",
    booking: "الحجز",
    updateError: "تعذّر تحديث الخطة.",
    aiQuotaExceeded: "لقد بلغت حدّ التخطيط بالذكاء الاصطناعي لهذا اليوم. يُعاد ضبطه عند منتصف الليل بتوقيت بيروت.",
    aiCapacityReached: "خدمة التخطيط بالذكاء الاصطناعي مشغولة حاليًا. يُرجى المحاولة لاحقًا.",
    rateLimited: "طلباتك سريعة بعض الشيء. يُرجى الانتظار قليلًا ثم المحاولة مجددًا.",
    tripLabel: "رحلة {id}",
    sealed: "مُغلقة",
    plannerKicker: "مخطِّط مشوار",
    pageTitle: "يومك. على طريقتك.",
    pageBody: "بعض التفاصيل. قليل من الإلهام. وشيء يستحق الخروج من أجله.",
    moodLabel: "ما الذي تشعر برغبة فيه؟",
    emptyKicker: "مساحة لشيء جميل",
    emptyHeading: "إلى أين سيأخذك اليوم؟",
    emptyTitle: "ابدأ بإحساس. ونساعدك في الباقي.",
    emptyBody: "صف يومك لتستكشف خطة عيّنة مبنية من أماكن منشورة.",
    takingShape: "يومك يتشكّل",
    editableNote: "يمكن تعديل ترتيب المحطات. أوقات التنقل وساعات العمل والتوفر تحتاج إلى تحقق مباشر.",
    savedPlanNote: "هذه خطتك المحفوظة. ابدأ خطة جديدة أو حسّنها لإجراء تغييرات.",
    noSavedPlan: "لا توجد خطة محفوظة لهذه الرحلة بعد. صف يومك بالأسفل لإنشاء واحدة.",
    flowStepOf: "خطوة {n} من {total}",
    flowStepDestination: "الوجهة",
    flowStepDetails: "التفاصيل",
    flowStepReview: "البرنامج",
    flowChooseTitle: "إلى أين تريد أن تذهب؟",
    flowChooseHint: "اختر وجهة وسننشئ لك خطة يوم حقيقية من الأماكن المنشورة هناك.",
    flowDetailsTitle: "تفاصيل الرحلة",
    flowDetailsHint: "بعض الأساسيات لتناسب الخطة يومك. يمكنك تغيير كل شيء لاحقاً.",
    flowDateLabel: "التاريخ",
    flowPartyLabel: "عدد الأشخاص",
    flowBudgetLabel: "الميزانية (دولار)",
    flowStrictLabel: "أبقِ الخطة ضمن هذه الميزانية",
    flowVibeLabel: "أي شيء محدد؟ (اختياري)",
    flowVibePlaceholder: "مثال: إيقاع هادئ، طعام جيد، إطلالة على البحر، مناسب للعائلة",
    flowBack: "رجوع",
    flowContinue: "متابعة",
    flowGenerate: "أنشئ البرنامج",
    flowGenerating: "نجهّز يومك…",
    flowStartOver: "ابدأ من جديد",
    flowReviewTitle: "برنامجك",
    flowReviewHint: "يُحفظ في رحلاتي تلقائياً. حسّنه أو بدّل المحطات أو اضبط المسار بالأسفل.",
    flowAdvancedTitle: "أدوات متقدمة",
    flowAdvancedHint: "حسّن المسار، تحقق من الطقس، وخطّط مع مجموعة.",
    flowOpenGroup: "التخطيط مع مجموعة",
    flowChangeDestination: "تغيير",
    flowNoDestinations: "لا توجد وجهات متاحة بعد.",
    flowRegenerating: "إعادة الإنشاء…",
    flowSelected: "مختارة",
    modeAi: "التخطيط بالذكاء الاصطناعي",
    modeManual: "أبنيها بنفسي",
    modeAiHint: "أخبرنا بالأجواء وسنبني اليوم.",
    modeManualHint: "اختر الأماكن بنفسك ورتّب يومك.",
    flowStepPlaces: "الأماكن",
    flowPickTitle: "اختر أماكنك",
    flowPickHint: "أضف أماكن حقيقية منشورة ثم رتّبها في يومك.",
    flowPickAdd: "إضافة",
    flowPickAdded: "مُضاف",
    flowPickEmpty: "لا توجد أماكن منشورة لهذه الوجهة بعد.",
    flowSelectedCount: "{n} مختارة",
    flowReorderHint: "استخدم الأسهم لترتيب يومك.",
    flowMoveUp: "تحريك لأعلى",
    flowMoveDown: "تحريك لأسفل",
    flowRemove: "إزالة",
    flowSave: "حفظ البرنامج",
    flowSaving: "جارٍ الحفظ…",
    flowYourDay: "يومك",
    flowAddMore: "إضافة أماكن أخرى",
    flowManualNeedPicks: "أضف مكاناً واحداً على الأقل للمتابعة.",
    flowManualReviewHint: "محفوظ في رحلاتي. الأوقات تقديرية بناءً على مدة الزيارة المعتادة لكل مكان.",
    flowEditManual: "تعديل يدوي",
    flowNoOverlap: "المحطات مجدولة تِباعاً، لذا لا تتداخل الأوقات.",
    stopsLabel: "محطات",
    estimateLabel: "تقدير تجربتك",
    ofBudget: "من ميزانية {budget}",
    partyLabel: "أشخاص",
    fineTune: "اضبط المسار",
    fineTuneBody: "حدّد نقطة انطلاق اليوم، ثم رتّب المحطات وتحقّق من الطقس.",
    previewAction: "معاينة",
    previewNote:
      "يستخدم المخطط التجريبي العروض المنشورة والأسعار المخزّنة. قد يكون الذكاء الاصطناعي والتحقق من المسار محدودين.",
    suggestionsLabel: "جرّب",
    suggestion1: "يوم هادئ على البحر لشخصين",
    suggestion2: "الأرز وغداء جبلي مع العائلة",
    suggestion3: "بدي يوم هادي بجبيل",
    routeStart: "نقطة الانطلاق",
    replacementsTitle: "بدائل",
  },
  fr: {
    startTitle: "D’où part ce plan ?",
    startHint: "Recherchez, déposez une épingle ou saisissez un lieu. La géolocalisation est facultative.",
    searchPlace: "Rechercher un lieu",
    searchPlaceholder: "Hamra, Byblos, aéroport…",
    dropPin: "Déposer une épingle",
    useLocation: "Utiliser ma position",
    locationDenied: "Permission refusée. Utilisez la recherche, l’épingle ou la saisie.",
    manualEntry: "Saisir un libellé et des coordonnées",
    saveStart: "Enregistrer comme départ par défaut",
    savedStart: "Enregistré dans le profil",
    precisePermission: "La position précise n’est demandée que si vous appuyez sur Utiliser ma position.",
    mapFallback: "Les tuiles carte nécessitent une clé navigateur. La grille d’épingles reste utilisable.",
    planTitle: "Itinéraire, météo et replanification",
    planHint:
      "Les temps de trajet viennent du service d’itinéraire. Les alertes météo ne modifient jamais les réservations.",
    optimize: "Optimiser l’ordre des arrêts",
    infeasible: "Aucun plan ne respecte les arrêts verrouillés, les horaires et l’heure de retour.",
    metricsUnavailable: "Le temps de trajet est indisponible. Ce ne sont pas des estimations.",
    weatherWarning: "Alerte météo",
    noWarning: "Aucune alerte météo pour ce plan.",
    forecastUnavailable: "Prévision indisponible — aucune alerte affichée.",
    replanAffected: "Reconstruire les arrêts touchés par la météo",
    replanNone: "Aucune alternative possible. Le plan actuel n’a pas été modifié.",
    before: "Avant",
    after: "Après",
    indoor: "Intérieur",
    outdoor: "Extérieur",
    weatherSensitive: "Sensible à la météo",
    thresholdsTitle: "Seuils d’alerte météo",
    thresholdsHint: "Les alertes nomment les arrêts concernés. Elles n’annulent jamais une réservation.",
    title: "Créateur de voyage",
    body: "Décrivez une journée en arabe, anglais ou français. Les arrêts viennent de l’inventaire publié. Les totaux sont calculés côté serveur.",
    placeholder: "Une journée lente à Byblos pour deux…",
    build: "Créer le plan",
    clarify: "Répondre et continuer",
    assumptions: "Hypothèses affichées",
    degraded: "La planification en langage naturel est indisponible. Filtres structurés uniquement.",
    timeline: "Chronologie",
    travel: "Trajet",
    cost: "Détail des coûts",
    total: "Total du plan",
    lock: "Verrouiller",
    unlock: "Déverrouiller",
    regenerate: "Régénérer le reste",
    replace: "Remplacer cet arrêt",
    accept: "Accepter le remplacement",
    cancel: "Annuler",
    refine: "Demander un changement",
    apply: "Appliquer",
    versions: "Historique des versions",
    sponsored: "Sponsorisé",
    estimated: "Estimé",
    fromPrice: "À partir de",
    quote: "Devis requis",
    why: "Pourquoi cet arrêt",
    booking: "Réservation",
    updateError: "Impossible de mettre à jour le plan.",
    aiQuotaExceeded:
      "Vous avez atteint la limite quotidienne de planification par IA. Elle se réinitialise à minuit, heure de Beyrouth.",
    aiCapacityReached: "La planification par IA est très sollicitée. Veuillez réessayer plus tard.",
    rateLimited: "Vous allez un peu vite. Patientez un instant puis réessayez.",
    tripLabel: "Voyage {id}",
    sealed: "scellé",
    plannerKicker: "Le planificateur Mshwar",
    pageTitle: "Votre journée. À votre façon.",
    pageBody: "Quelques détails. Un peu d’inspiration. Une vraie raison de sortir.",
    moodLabel: "De quoi avez-vous envie ?",
    emptyKicker: "De la place pour du bon",
    emptyHeading: "Où la journée vous mènera-t-elle ?",
    emptyTitle: "Partez d’une envie. On s’occupe du reste.",
    emptyBody: "Décrivez votre journée pour découvrir un plan exemple construit à partir de lieux publiés.",
    takingShape: "Votre journée prend forme",
    editableNote:
      "L’ordre des étapes est modifiable. Trajets, horaires et disponibilités restent à vérifier en direct.",
    savedPlanNote: "Voici votre itinéraire enregistré. Lancez un nouveau plan ou affinez-le pour le modifier.",
    noSavedPlan: "Ce voyage n’a pas encore de plan enregistré. Décrivez votre journée ci-dessous pour en générer un.",
    flowStepOf: "Étape {n} sur {total}",
    flowStepDestination: "Destination",
    flowStepDetails: "Détails",
    flowStepReview: "Itinéraire",
    flowChooseTitle: "Où voulez-vous aller ?",
    flowChooseHint: "Choisissez une destination et nous créerons un vrai plan de journée à partir des lieux publiés.",
    flowDetailsTitle: "Détails du voyage",
    flowDetailsHint: "Quelques bases pour adapter le plan à votre journée. Tout est modifiable ensuite.",
    flowDateLabel: "Date",
    flowPartyLabel: "Nombre de personnes",
    flowBudgetLabel: "Budget (USD)",
    flowStrictLabel: "Rester dans ce budget",
    flowVibeLabel: "Quelque chose de précis ? (facultatif)",
    flowVibePlaceholder: "ex. rythme tranquille, bonne cuisine, vue sur mer, en famille",
    flowBack: "Retour",
    flowContinue: "Continuer",
    flowGenerate: "Générer l'itinéraire",
    flowGenerating: "Création de votre journée…",
    flowStartOver: "Recommencer",
    flowReviewTitle: "Votre itinéraire",
    flowReviewHint:
      "Enregistré dans Mes voyages automatiquement. Affinez-le, changez des étapes ou ajustez l'itinéraire ci-dessous.",
    flowAdvancedTitle: "Outils avancés",
    flowAdvancedHint: "Optimisez l'itinéraire, vérifiez la météo et planifiez en groupe.",
    flowOpenGroup: "Planifier en groupe",
    flowChangeDestination: "Changer",
    flowNoDestinations: "Aucune destination n'est encore disponible.",
    flowRegenerating: "Régénération…",
    flowSelected: "Sélectionnée",
    modeAi: "Planifier avec l'IA",
    modeManual: "Le faire moi-même",
    modeAiHint: "Dites l'ambiance, on construit la journée.",
    modeManualHint: "Choisissez les lieux et organisez la journée.",
    flowStepPlaces: "Lieux",
    flowPickTitle: "Choisissez vos lieux",
    flowPickHint: "Ajoutez de vrais lieux publiés, puis organisez votre journée.",
    flowPickAdd: "Ajouter",
    flowPickAdded: "Ajouté",
    flowPickEmpty: "Aucun lieu publié pour cette destination pour l'instant.",
    flowSelectedCount: "{n} sélectionné(s)",
    flowReorderHint: "Utilisez les flèches pour ordonner votre journée.",
    flowMoveUp: "Monter",
    flowMoveDown: "Descendre",
    flowRemove: "Retirer",
    flowSave: "Enregistrer l'itinéraire",
    flowSaving: "Enregistrement…",
    flowYourDay: "Votre journée",
    flowAddMore: "Ajouter d'autres lieux",
    flowManualNeedPicks: "Ajoutez au moins un lieu pour continuer.",
    flowManualReviewHint: "Enregistré dans Mes voyages. Les horaires sont estimés selon la durée de visite habituelle.",
    flowEditManual: "Modifier manuellement",
    flowNoOverlap: "Les étapes s'enchaînent, les horaires ne se chevauchent jamais.",
    stopsLabel: "étapes",
    estimateLabel: "Estimation de votre journée",
    ofBudget: "sur un budget de {budget}",
    partyLabel: "personnes",
    fineTune: "Affiner l’itinéraire",
    fineTuneBody: "Choisissez le point de départ, puis optimisez l’ordre des étapes et vérifiez la météo.",
    previewAction: "Aperçu",
    previewNote:
      "Le planificateur d’aperçu utilise l’inventaire publié et les prix enregistrés. L’IA et la validation d’itinéraire peuvent être limitées.",
    suggestionsLabel: "Essayez",
    suggestion1: "Une journée tranquille au bord de la mer à deux",
    suggestion2: "Les cèdres et un déjeuner en montagne en famille",
    suggestion3: "Une journée d’histoire à Baalbek",
    routeStart: "Point de départ",
    replacementsTitle: "Alternatives",
  },
};

export type PlannerCopy = Record<PlannerKey, string>;

export function usePlannerCopy(): PlannerCopy {
  const { locale } = useLocale();
  return plannerCopy[locale];
}
