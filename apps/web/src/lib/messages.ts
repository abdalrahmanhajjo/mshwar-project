import type { Locale } from "@/lib/locale";

export type MessageKey =
  | "skipToContent"
  | "openMenu"
  | "closeMenu"
  | "language"
  | "signIn"
  | "signUp"
  | "signOut"
  | "email"
  | "password"
  | "displayName"
  | "createAccount"
  | "haveAccount"
  | "noAccount"
  | "authError"
  | "passwordHint"
  | "forgotPassword"
  | "resetPassword"
  | "sendResetLink"
  | "resetSent"
  | "forgotHint"
  | "newPassword"
  | "invalidReset"
  | "updatePassword"
  | "backToSignIn"
  | "verifyEmail"
  | "verifyEmailHint"
  | "emailVerified"
  | "invalidVerify"
  | "resendVerification"
  | "verificationSent"
  | "unverifiedBanner"
  | "verifyToBook"
  | "verified"
  | "unverified"
  | "profile"
  | "profileHint"
  | "preferences"
  | "preferencesHint"
  | "explicitOnly"
  | "homeArea"
  | "groupSize"
  | "dietary"
  | "accessibility"
  | "activityIntensity"
  | "interests"
  | "saveProfile"
  | "profileSaved"
  | "notSet"
  | "nextPlanUsesDefaults"
  | "homeAreaStub"
  | "signedInAs"
  | "discover"
  | "destinations"
  | "experiences"
  | "planATrip"
  | "myTrips"
  | "ideas"
  | "collections"
  | "forBusinesses"
  | "plan"
  | "saved"
  | "favorites"
  | "notifications"
  | "bookings"
  | "reviews"
  | "dashboard"
  | "listings"
  | "finance"
  | "team"
  | "overview"
  | "users"
  | "businesses"
  | "moderation"
  | "settings"
  | "verificationQueue"
  | "taxonomy"
  | "supportCases"
  | "dataQuality"
  | "notificationHealth"
  | "adminRoles"
  | "adminBookings"
  | "privacy"
  | "terms"
  | "contact"
  | "travellerFooter"
  | "businessFooter"
  | "adminFooter"
  | "guest"
  | "menu"
  | "travellerSurface"
  | "businessSurface"
  | "adminSurface"
  | "plannerHealth"
  | "auditLog"
  | "notFound"
  | "notFoundBody"
  | "contactTitle"
  | "contactBody"
  | "planBody"
  | "planFromCollection"
  | "planStopsOne"
  | "planStopsOther"
  | "tripLabel"
  | "estimate"
  | "fieldRequired"
  | "fieldInvalid"
  | "startDate"
  | "endDate"
  | "datesLegend"
  | "carouselPrevious"
  | "carouselNext"
  | "accountMenu"
  | "yourMshwar"
  | "hubTagline"
  | "backHome"
  | "notFoundKicker"
  | "authWelcome"
  | "authJoin"
  | "authAside"
  | "authAsideKicker"
  | "contactKicker"
  | "contactTravellersTitle"
  | "contactTravellersBody"
  | "contactBusinessTitle"
  | "contactBusinessBody"
  | "contactPrivacyTitle"
  | "contactPrivacyBody"
  | "openBookings"
  | "openPortal"
  | "openSettings"
  | "legalKicker"
  | "consoleGreeting"
  | "errorKicker"
  | "errorTitle"
  | "errorBody"
  | "tryAgain";

export const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    displayName: "Display name",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    noAccount: "New to Mshwar?",
    authError: "Something went wrong. Try again.",
    passwordHint: "At least 10 characters. Stored as an Argon2id hash — never logged.",
    forgotPassword: "Forgot password?",
    resetPassword: "Reset password",
    sendResetLink: "Send reset link",
    resetSent: "If an account exists for this address, a reset link has been sent.",
    forgotHint: "Enter the email on the account. The next screen is the same whether or not it is registered.",
    newPassword: "New password",
    invalidReset: "This reset link is invalid or has expired.",
    updatePassword: "Update password",
    backToSignIn: "Back to sign in",
    verifyEmail: "Verify email",
    verifyEmailHint: "Open the link we sent, or resend it. Booking stays locked until the address is confirmed.",
    emailVerified: "Your email is verified. You can book.",
    invalidVerify: "This verification link is invalid or has expired.",
    resendVerification: "Resend verification email",
    verificationSent: "If this address still needs verification, a new link has been sent.",
    unverifiedBanner: "Verify your email to book. You can still browse.",
    verifyToBook: "Unverified accounts can browse but cannot book.",
    verified: "Verified",
    unverified: "Unverified",
    profile: "Profile",
    profileHint: "Name, language, start area and group size for the next plan.",
    preferences: "Preferences",
    preferencesHint: "Optional. Only what you choose is stored — nothing is inferred.",
    explicitOnly: "Every preference is an explicit choice. Clear a chip to leave it unset.",
    homeArea: "Home or start area",
    groupSize: "Default group size",
    dietary: "Dietary",
    accessibility: "Accessibility",
    activityIntensity: "Activity intensity",
    interests: "Interests",
    saveProfile: "Save profile",
    profileSaved: "Saved. The next plan will use these defaults.",
    notSet: "Not set",
    nextPlanUsesDefaults: "These are defaults, not constraints. A trip can override any of them.",
    homeAreaStub: "Region list for preferences. Set a precise start on the plan map picker.",
    signedInAs: "Signed in as",
    discover: "Discover",
    destinations: "Destinations",
    experiences: "Experiences",
    planATrip: "Plan a trip",
    myTrips: "My trips",
    ideas: "Ideas",
    collections: "Collections",
    forBusinesses: "For businesses",
    plan: "Plan",
    saved: "Saved",
    favorites: "Favorites",
    notifications: "Notifications",
    bookings: "Bookings",
    reviews: "Reviews",
    dashboard: "Dashboard",
    listings: "Listings",
    finance: "Finance",
    team: "Team",
    overview: "Overview",
    users: "Users",
    businesses: "Businesses",
    moderation: "Moderation",
    verificationQueue: "Verification",
    taxonomy: "Taxonomy",
    supportCases: "Cases",
    dataQuality: "Quality",
    notificationHealth: "Notifications",
    adminRoles: "Roles",
    adminBookings: "Bookings",
    settings: "Settings",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    travellerFooter: "Discover. Plan. Book Lebanon.",
    businessFooter: "Business portal — structured inventory only.",
    adminFooter: "Admin console — internal operators.",
    guest: "Guest",
    menu: "Menu",
    travellerSurface: "Traveller",
    businessSurface: "Business",
    adminSurface: "Admin",
    plannerHealth: "Planner health",
    auditLog: "Audit log",
    notFound: "Page not found",
    notFoundBody: "That page is not in the catalogue.",
    contactTitle: "Contact",
    contactBody: "Reach the Mshwar team.",
    planBody: "Build an itinerary from structured inventory.",
    planFromCollection: "Started from “{title}”.",
    planStopsOne: "{count} published stop. Edit from structured inventory only.",
    planStopsOther: "{count} published stops. Edit from structured inventory only.",
    tripLabel: "Trip {id}",
    estimate: "Estimate",
    fieldRequired: "This field is required.",
    fieldInvalid: "Check this field and try again.",
    startDate: "Start date",
    endDate: "End date",
    datesLegend: "Dates",
    carouselPrevious: "Previous",
    carouselNext: "Next",
    accountMenu: "Account",
    yourMshwar: "Your Mshwar",
    hubTagline: "A little planning. A lot to discover.",
    backHome: "Back to discover",
    notFoundKicker: "Off the map",
    authWelcome: "Welcome back.",
    authJoin: "Start your first mshwar.",
    authAside: "Save the places you love, plan full days and keep every booking in one place.",
    authAsideKicker: "Lebanon, at your own pace.",
    contactKicker: "We’re here to help",
    contactTravellersTitle: "Trips and bookings",
    contactTravellersBody: "Check the status of a request, cancel, or retrieve a confirmation from your bookings.",
    contactBusinessTitle: "List your business",
    contactBusinessBody: "Verified local partners manage listings, availability and requests in the business portal.",
    contactPrivacyTitle: "Your data",
    contactPrivacyBody: "Export, reset or delete your account data at any time from settings.",
    openBookings: "Open my bookings",
    openPortal: "Open the business portal",
    openSettings: "Open settings",
    legalKicker: "The small print",
    consoleGreeting: "Signed in to",
    errorKicker: "Something went wrong",
    errorTitle: "This page could not load.",
    errorBody: "It is not you. Try again in a moment, or head back to discover places.",
    tryAgain: "Try again",
  },
  ar: {
    skipToContent: "تخطّ إلى المحتوى",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    language: "اللغة",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    displayName: "الاسم الظاهر",
    createAccount: "إنشاء الحساب",
    haveAccount: "لديك حساب؟",
    noAccount: "جديد على مشوار؟",
    authError: "حدث خطأ. حاول مرة أخرى.",
    passwordHint: "عشرة أحرف على الأقل. تُحفظ كتجزئة Argon2id ولا تُسجَّل كنص.",
    forgotPassword: "نسيت كلمة المرور؟",
    resetPassword: "إعادة تعيين كلمة المرور",
    sendResetLink: "إرسال الرابط",
    resetSent: "إذا كان هناك حساب لهذا العنوان، فقد أُرسل رابط إعادة التعيين.",
    forgotHint: "أدخل البريد الإلكتروني للحساب. الرسالة التالية واحدة سواء وُجد الحساب أم لا.",
    newPassword: "كلمة المرور الجديدة",
    invalidReset: "رابط إعادة التعيين غير صالح أو منتهٍ.",
    updatePassword: "تحديث كلمة المرور",
    backToSignIn: "العودة لتسجيل الدخول",
    verifyEmail: "تأكيد البريد",
    verifyEmailHint: "افتح الرابط الذي أرسلناه أو أعد الإرسال. يبقى الحجز مقفلاً حتى تأكيد العنوان.",
    emailVerified: "تم تأكيد بريدك. يمكنك الحجز.",
    invalidVerify: "رابط التأكيد غير صالح أو منتهٍ.",
    resendVerification: "إعادة إرسال رسالة التأكيد",
    verificationSent: "إذا كان هذا العنوان ما زال يحتاج تأكيداً، فقد أُرسل رابط جديد.",
    unverifiedBanner: "أكّد بريدك لتتمكن من الحجز. يمكنك التصفح.",
    verifyToBook: "الحسابات غير المؤكدة تتصفح ولا تحجز.",
    verified: "مؤكّد",
    unverified: "غير مؤكّد",
    profile: "الملف",
    profileHint: "الاسم واللغة ومنطقة الانطلاق وحجم المجموعة للخطة التالية.",
    preferences: "التفضيلات",
    preferencesHint: "اختيارية. يُحفظ ما تختاره فقط — لا يُستنتج شيء.",
    explicitOnly: "كل تفضيل اختيار صريح. أزل الشارة لتركه فارغاً.",
    homeArea: "منطقة السكن أو الانطلاق",
    groupSize: "حجم المجموعة الافتراضي",
    dietary: "الغذاء",
    accessibility: "إمكانية الوصول",
    activityIntensity: "شدة النشاط",
    interests: "الاهتمامات",
    saveProfile: "حفظ الملف",
    profileSaved: "تم الحفظ. ستستخدمها الخطة التالية كافتراضيات.",
    notSet: "غير محدد",
    nextPlanUsesDefaults: "هذه افتراضيات وليست قيوداً. يمكن لأي رحلة تجاوزها.",
    homeAreaStub: "قائمة مناطق للتفضيلات. حدّد انطلاقاً دقيقاً من ملتقط خريطة الخطة.",
    signedInAs: "مسجّل الدخول باسم",
    discover: "اكتشف",
    destinations: "الوجهات",
    experiences: "التجارب",
    planATrip: "خطّط لرحلة",
    myTrips: "رحلاتي",
    ideas: "أفكار",
    collections: "مجموعات",
    forBusinesses: "للأعمال",
    plan: "خطّط",
    saved: "المحفوظات",
    favorites: "المفضلة",
    notifications: "الإشعارات",
    bookings: "الحجوزات",
    reviews: "التقييمات",
    dashboard: "لوحة التحكم",
    listings: "العروض",
    finance: "المالية",
    team: "الفريق",
    overview: "نظرة عامة",
    users: "المستخدمون",
    businesses: "الشركات",
    moderation: "الإشراف",
    verificationQueue: "التحقق",
    taxonomy: "التصنيف",
    supportCases: "الحالات",
    dataQuality: "الجودة",
    notificationHealth: "الإشعارات",
    adminRoles: "الأدوار",
    adminBookings: "الحجوزات",
    settings: "الإعدادات",
    privacy: "الخصوصية",
    terms: "الشروط",
    contact: "تواصل",
    travellerFooter: "اكتشف. خطّط. احجز لبنان.",
    businessFooter: "بوابة الأعمال — مخزون منظّم فقط.",
    adminFooter: "وحدة الإدارة — للمشغّلين الداخليين.",
    guest: "زائر",
    menu: "القائمة",
    travellerSurface: "المسافر",
    businessSurface: "الأعمال",
    adminSurface: "الإدارة",
    plannerHealth: "صحة المخطِّط",
    auditLog: "سجل التدقيق",
    notFound: "الصفحة غير موجودة",
    notFoundBody: "هذه الصفحة ليست في الكتالوج.",
    contactTitle: "تواصل",
    contactBody: "تواصل مع فريق مشوار.",
    planBody: "ابنِ مساراً من المخزون المنظّم فقط.",
    planFromCollection: "بدأت من «{title}».",
    planStopsOne: "محطة منشورة واحدة. عدّل من المخزون المنظّم فقط.",
    planStopsOther: "{count} محطات منشورة. عدّل من المخزون المنظّم فقط.",
    tripLabel: "رحلة {id}",
    estimate: "تقدير",
    fieldRequired: "هذا الحقل مطلوب.",
    fieldInvalid: "راجع هذا الحقل ثم أعد المحاولة.",
    startDate: "تاريخ البداية",
    endDate: "تاريخ النهاية",
    datesLegend: "التواريخ",
    carouselPrevious: "السابق",
    carouselNext: "التالي",
    accountMenu: "الحساب",
    yourMshwar: "مشوارك",
    hubTagline: "قليل من التخطيط. الكثير لتكتشفه.",
    backHome: "العودة إلى الاستكشاف",
    notFoundKicker: "خارج الخريطة",
    authWelcome: "أهلاً بعودتك.",
    authJoin: "ابدأ مشوارك الأول.",
    authAside: "احفظ الأماكن التي تحبها، خطّط لأيام كاملة واحتفظ بكل حجوزاتك في مكان واحد.",
    authAsideKicker: "لبنان، على مهلك.",
    contactKicker: "نحن هنا للمساعدة",
    contactTravellersTitle: "الرحلات والحجوزات",
    contactTravellersBody: "تحقّق من حالة الطلب أو ألغِه أو استرجع التأكيد من صفحة حجوزاتك.",
    contactBusinessTitle: "أضف نشاطك التجاري",
    contactBusinessBody: "يدير الشركاء المحليون الموثّقون العروض والتوفر والطلبات من بوابة الأعمال.",
    contactPrivacyTitle: "بياناتك",
    contactPrivacyBody: "صدّر بيانات حسابك أو أعد ضبطها أو احذفها في أي وقت من الإعدادات.",
    openBookings: "افتح حجوزاتي",
    openPortal: "افتح بوابة الأعمال",
    openSettings: "افتح الإعدادات",
    legalKicker: "التفاصيل الدقيقة",
    consoleGreeting: "مسجّل الدخول إلى",
    errorKicker: "حدث خطأ",
    errorTitle: "تعذّر تحميل هذه الصفحة.",
    errorBody: "المشكلة ليست من جهتك. حاول مجددًا بعد قليل، أو عد إلى استكشاف الأماكن.",
    tryAgain: "حاول مجددًا",
  },
  fr: {
    skipToContent: "Aller au contenu",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    language: "Langue",
    signIn: "Connexion",
    signUp: "Créer un compte",
    signOut: "Déconnexion",
    email: "E-mail",
    password: "Mot de passe",
    displayName: "Nom affiché",
    createAccount: "Créer le compte",
    haveAccount: "Vous avez déjà un compte ?",
    noAccount: "Nouveau sur Mshwar ?",
    authError: "Une erreur s’est produite. Réessayez.",
    passwordHint: "Au moins 10 caractères. Stocké en Argon2id — jamais consigné en clair.",
    forgotPassword: "Mot de passe oublié ?",
    resetPassword: "Réinitialiser le mot de passe",
    sendResetLink: "Envoyer le lien",
    resetSent: "Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.",
    forgotHint: "Saisissez l’e-mail du compte. L’écran suivant est identique que l’adresse soit inscrite ou non.",
    newPassword: "Nouveau mot de passe",
    invalidReset: "Ce lien de réinitialisation est invalide ou a expiré.",
    updatePassword: "Mettre à jour le mot de passe",
    backToSignIn: "Retour à la connexion",
    verifyEmail: "Vérifier l’e-mail",
    verifyEmailHint:
      "Ouvrez le lien envoyé ou renvoyez-le. La réservation reste bloquée tant que l’adresse n’est pas confirmée.",
    emailVerified: "Votre e-mail est vérifié. Vous pouvez réserver.",
    invalidVerify: "Ce lien de vérification est invalide ou a expiré.",
    resendVerification: "Renvoyer l’e-mail de vérification",
    verificationSent: "Si cette adresse doit encore être vérifiée, un nouveau lien a été envoyé.",
    unverifiedBanner: "Vérifiez votre e-mail pour réserver. Vous pouvez encore parcourir.",
    verifyToBook: "Les comptes non vérifiés peuvent parcourir mais pas réserver.",
    verified: "Vérifié",
    unverified: "Non vérifié",
    profile: "Profil",
    profileHint: "Nom, langue, zone de départ et taille du groupe pour le prochain plan.",
    preferences: "Préférences",
    preferencesHint: "Facultatives. Seul ce que vous choisissez est enregistré — rien n’est déduit.",
    explicitOnly: "Chaque préférence est un choix explicite. Retirez une puce pour la laisser vide.",
    homeArea: "Zone de domicile ou de départ",
    groupSize: "Taille de groupe par défaut",
    dietary: "Régime",
    accessibility: "Accessibilité",
    activityIntensity: "Intensité",
    interests: "Intérêts",
    saveProfile: "Enregistrer le profil",
    profileSaved: "Enregistré. Le prochain plan utilisera ces valeurs par défaut.",
    notSet: "Non défini",
    nextPlanUsesDefaults: "Ce sont des valeurs par défaut, pas des contraintes. Un voyage peut les remplacer.",
    homeAreaStub: "Liste de régions pour les préférences. Définissez un départ précis via le sélecteur carte du plan.",
    signedInAs: "Connecté en tant que",
    discover: "Découvrir",
    destinations: "Destinations",
    experiences: "Expériences",
    planATrip: "Planifier un voyage",
    myTrips: "Mes voyages",
    ideas: "Idées",
    collections: "Collections",
    forBusinesses: "Pour les entreprises",
    plan: "Planifier",
    saved: "Enregistrés",
    favorites: "Favoris",
    notifications: "Notifications",
    bookings: "Réservations",
    reviews: "Avis",
    dashboard: "Tableau de bord",
    listings: "Annonces",
    finance: "Finance",
    team: "Équipe",
    overview: "Aperçu",
    users: "Utilisateurs",
    businesses: "Entreprises",
    moderation: "Modération",
    verificationQueue: "Vérification",
    taxonomy: "Taxonomie",
    supportCases: "Tickets",
    dataQuality: "Qualité",
    notificationHealth: "Notifications",
    adminRoles: "Rôles",
    adminBookings: "Réservations",
    settings: "Réglages",
    privacy: "Confidentialité",
    terms: "Conditions",
    contact: "Contact",
    travellerFooter: "Découvrir. Planifier. Réserver le Liban.",
    businessFooter: "Portail professionnel — inventaire structuré uniquement.",
    adminFooter: "Console d’administration — opérateurs internes.",
    guest: "Invité",
    menu: "Menu",
    travellerSurface: "Voyageur",
    businessSurface: "Professionnel",
    adminSurface: "Admin",
    plannerHealth: "Santé du planificateur",
    auditLog: "Journal d’audit",
    notFound: "Page introuvable",
    notFoundBody: "Cette page n’est pas dans le catalogue.",
    contactTitle: "Contact",
    contactBody: "Contacter l’équipe Mshwar.",
    planBody: "Construisez un itinéraire à partir de l’inventaire structuré.",
    planFromCollection: "Commencé à partir de « {title} ».",
    planStopsOne: "{count} étape publiée. Modifiez uniquement l’inventaire structuré.",
    planStopsOther: "{count} étapes publiées. Modifiez uniquement l’inventaire structuré.",
    tripLabel: "Voyage {id}",
    estimate: "Estimation",
    fieldRequired: "Ce champ est obligatoire.",
    fieldInvalid: "Vérifiez ce champ et réessayez.",
    startDate: "Date de début",
    endDate: "Date de fin",
    datesLegend: "Dates",
    carouselPrevious: "Précédent",
    carouselNext: "Suivant",
    accountMenu: "Compte",
    yourMshwar: "Votre Mshwar",
    hubTagline: "Un peu d’organisation. Beaucoup à découvrir.",
    backHome: "Retour à la découverte",
    notFoundKicker: "Hors de la carte",
    authWelcome: "Content de vous revoir.",
    authJoin: "Commencez votre premier mshwar.",
    authAside:
      "Enregistrez les lieux que vous aimez, planifiez des journées entières et gardez vos réservations au même endroit.",
    authAsideKicker: "Le Liban, à votre rythme.",
    contactKicker: "Nous sommes là pour aider",
    contactTravellersTitle: "Voyages et réservations",
    contactTravellersBody:
      "Consultez le statut d’une demande, annulez ou retrouvez une confirmation depuis vos réservations.",
    contactBusinessTitle: "Référencer votre activité",
    contactBusinessBody:
      "Les partenaires locaux vérifiés gèrent offres, disponibilités et demandes dans le portail professionnel.",
    contactPrivacyTitle: "Vos données",
    contactPrivacyBody:
      "Exportez, réinitialisez ou supprimez les données de votre compte à tout moment depuis les paramètres.",
    openBookings: "Ouvrir mes réservations",
    openPortal: "Ouvrir le portail professionnel",
    openSettings: "Ouvrir les paramètres",
    legalKicker: "Les détails",
    consoleGreeting: "Connecté à",
    errorKicker: "Un problème est survenu",
    errorTitle: "Cette page n’a pas pu se charger.",
    errorBody: "Ce n’est pas vous. Réessayez dans un instant ou revenez à la découverte.",
    tryAgain: "Réessayer",
  },
};
