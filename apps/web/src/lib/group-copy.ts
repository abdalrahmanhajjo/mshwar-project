import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type GroupKey =
  | "title"
  | "share"
  | "participants"
  | "voting"
  | "summary"
  | "lock"
  | "lockedBy"
  | "yes"
  | "no"
  | "join"
  | "joinHint"
  | "displayName"
  | "guestJoin"
  | "revoked"
  | "createLink"
  | "allowGuest"
  | "agreement"
  | "disagreement"
  | "tradeoffs"
  | "openGroup"
  | "guideKicker"
  | "guideTitle"
  | "guideBody"
  | "itinerary"
  | "itineraryHint"
  | "noItinerary"
  | "noItineraryHint"
  | "openPlanner"
  | "travelers"
  | "travelersHint"
  | "invite"
  | "headcount"
  | "dayTotal"
  | "stopsLabel"
  | "finalize"
  | "finalized"
  | "printSheet"
  | "votingHint"
  | "summaryHint"
  | "statusDraft"
  | "statusLocked"
  | "statusArchived"
  | "roleLabel"
  | "addedBy"
  | "you"
  | "guide"
  | "traveller"
  | "proposeHint";

export const groupCopy: Record<Locale, Record<GroupKey, string>> = {
  en: {
    title: "Group planning",
    share: "Share this trip",
    participants: "Who has joined",
    voting: "Vote on suggestions",
    summary: "Where the group agrees",
    lock: "Lock trip and close voting",
    lockedBy: "Locked by",
    yes: "Yes",
    no: "No",
    join: "Join this trip",
    joinHint: "The link itself decides whether you can look, vote or edit.",
    displayName: "Display name",
    guestJoin: "Join as guest",
    revoked: "This link is no longer valid.",
    createLink: "Create share link",
    allowGuest: "Allow guests without an account",
    agreement: "Agreement",
    disagreement: "Disagreement",
    tradeoffs: "Trade-offs",
    openGroup: "Guide dashboard",
    guideKicker: "Tour group",
    guideTitle: "Guide dashboard",
    guideBody: "Share the day with your travellers, gather their votes, and lock the final plan.",
    itinerary: "Day itinerary",
    itineraryHint: "The plan your travellers will follow.",
    noItinerary: "No itinerary yet",
    noItineraryHint: "Build the day in the planner, then it appears here for your group.",
    openPlanner: "Open in planner",
    travelers: "Your group",
    travelersHint: "Everyone who has joined this trip.",
    invite: "Invite travellers",
    headcount: "Travellers",
    dayTotal: "Est. per person",
    stopsLabel: "stops",
    finalize: "Finalise & lock",
    finalized: "Finalised",
    printSheet: "Print day sheet",
    votingHint: "Let your group vote on what to keep.",
    summaryHint: "Where your travellers agree and differ.",
    statusDraft: "Planning",
    statusLocked: "Locked",
    statusArchived: "Archived",
    roleLabel: "Access",
    addedBy: "Added by",
    you: "You",
    guide: "Guide",
    traveller: "Traveller",
    proposeHint: "Travellers can suggest places from any experience page.",
  },
  ar: {
    title: "تخطيط المجموعة",
    share: "شارك هذه الرحلة",
    participants: "من انضم",
    voting: "التصويت على الاقتراحات",
    summary: "أين تتفق المجموعة",
    lock: "قفل الرحلة وإغلاق التصويت",
    lockedBy: "قفلها",
    yes: "نعم",
    no: "لا",
    join: "انضم إلى هذه الرحلة",
    joinHint: "الرابط يحدد إن كان بإمكانك المشاهدة أو التصويت أو التعديل.",
    displayName: "الاسم الظاهر",
    guestJoin: "انضم كضيف",
    revoked: "هذا الرابط لم يعد صالحاً.",
    createLink: "إنشاء رابط مشاركة",
    allowGuest: "السماح للضيوف دون حساب",
    agreement: "اتفاق",
    disagreement: "اختلاف",
    tradeoffs: "مقايضات",
    openGroup: "لوحة المرشد",
    guideKicker: "مجموعة الجولة",
    guideTitle: "لوحة المرشد",
    guideBody: "شارك اليوم مع مسافريك، اجمع أصواتهم، وثبّت الخطة النهائية.",
    itinerary: "برنامج اليوم",
    itineraryHint: "الخطة التي سيتبعها مسافروك.",
    noItinerary: "لا يوجد برنامج بعد",
    noItineraryHint: "جهّز اليوم في المخطّط، ثم يظهر هنا لمجموعتك.",
    openPlanner: "فتح في المخطّط",
    travelers: "مجموعتك",
    travelersHint: "كل من انضم إلى هذه الرحلة.",
    invite: "دعوة المسافرين",
    headcount: "المسافرون",
    dayTotal: "تقدير للشخص",
    stopsLabel: "محطات",
    finalize: "إنهاء وقفل",
    finalized: "مُنهاة",
    printSheet: "طباعة ورقة اليوم",
    votingHint: "دع مجموعتك تصوّت على ما تريد الإبقاء عليه.",
    summaryHint: "أين يتفق مسافروك وأين يختلفون.",
    statusDraft: "قيد التخطيط",
    statusLocked: "مقفلة",
    statusArchived: "مؤرشفة",
    roleLabel: "الوصول",
    addedBy: "أضافها",
    you: "أنت",
    guide: "المرشد",
    traveller: "مسافر",
    proposeHint: "يمكن للمسافرين اقتراح أماكن من أي صفحة تجربة.",
  },
  fr: {
    title: "Planification de groupe",
    share: "Partager ce voyage",
    participants: "Qui a rejoint",
    voting: "Voter sur les suggestions",
    summary: "Là où le groupe s’accorde",
    lock: "Verrouiller et fermer les votes",
    lockedBy: "Verrouillé par",
    yes: "Oui",
    no: "Non",
    join: "Rejoindre ce voyage",
    joinHint: "Le lien décide si vous pouvez voir, voter ou modifier.",
    displayName: "Nom affiché",
    guestJoin: "Rejoindre en invité",
    revoked: "Ce lien n’est plus valable.",
    createLink: "Créer un lien",
    allowGuest: "Autoriser les invités sans compte",
    agreement: "Accord",
    disagreement: "Désaccord",
    tradeoffs: "Compromis",
    openGroup: "Tableau guide",
    guideKicker: "Groupe de tour",
    guideTitle: "Tableau de bord guide",
    guideBody: "Partagez la journée avec vos voyageurs, recueillez leurs votes et verrouillez le plan final.",
    itinerary: "Itinéraire du jour",
    itineraryHint: "Le plan que suivront vos voyageurs.",
    noItinerary: "Pas encore d'itinéraire",
    noItineraryHint: "Construisez la journée dans le planificateur, puis elle apparaît ici pour votre groupe.",
    openPlanner: "Ouvrir le planificateur",
    travelers: "Votre groupe",
    travelersHint: "Toutes les personnes ayant rejoint ce voyage.",
    invite: "Inviter des voyageurs",
    headcount: "Voyageurs",
    dayTotal: "Est. par personne",
    stopsLabel: "étapes",
    finalize: "Finaliser et verrouiller",
    finalized: "Finalisé",
    printSheet: "Imprimer la feuille du jour",
    votingHint: "Laissez votre groupe voter sur ce qu'il faut garder.",
    summaryHint: "Là où vos voyageurs s'accordent et divergent.",
    statusDraft: "Planification",
    statusLocked: "Verrouillé",
    statusArchived: "Archivé",
    roleLabel: "Accès",
    addedBy: "Ajouté par",
    you: "Vous",
    guide: "Guide",
    traveller: "Voyageur",
    proposeHint: "Les voyageurs peuvent suggérer des lieux depuis n'importe quelle page d'expérience.",
  },
};

export function useGroupCopy() {
  const { locale } = useLocale();
  return groupCopy[locale];
}
