import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type HubKey =
  | "tripsTitle"
  | "tripsBody"
  | "tripsEmpty"
  | "tripsEmptyHint"
  | "planTrip"
  | "archiveTrip"
  | "archived"
  | "draft"
  | "locked"
  | "favoritesTitle"
  | "favoritesBody"
  | "favoritesEmpty"
  | "favoritesEmptyHint"
  | "explorePlaces"
  | "unfavorite"
  | "bookingsTitle"
  | "bookingsBody"
  | "bookingsEmpty"
  | "bookingsEmptyHint"
  | "browseToBook"
  | "cancelBooking"
  | "cancelReason"
  | "confirmCancel"
  | "cancelled"
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "completed"
  | "policySummary"
  | "notificationsTitle"
  | "notificationsBody"
  | "notificationsEmpty"
  | "notificationsEmptyHint"
  | "markRead"
  | "unread"
  | "read"
  | "openItem"
  | "pageLabel"
  | "newTrip"
  | "tripsKicker"
  | "favoritesKicker"
  | "bookingsKicker"
  | "notificationsKicker"
  | "settingsKicker"
  | "settingsTitle"
  | "settingsBody"
  | "createdOn"
  | "openTrip"
  | "viewList"
  | "viewCalendar"
  | "unscheduled"
  | "scheduledFor"
  | "planned"
  | "allDays"
  | "noTripsDay"
  | "statusDraft"
  | "statusLocked"
  | "statusArchived"
  | "stopsOne"
  | "stopsOther"
  | "bookedOn"
  | "checkoutBookings"
  | "listingBookings"
  | "unreadCount";

export const hubCopy: Record<Locale, Record<HubKey, string>> = {
  en: {
    tripsTitle: "Your trips",
    tripsBody: "Drafts, locked plans and archived itineraries — only yours.",
    tripsEmpty: "No trips yet.",
    tripsEmptyHint: "Start a plan. It will show up here with its status.",
    planTrip: "Plan a trip",
    archiveTrip: "Archive trip",
    archived: "Archived",
    draft: "Draft",
    locked: "Locked",
    favoritesTitle: "Favorites",
    favoritesBody: "Places you kept for later. Unfavorite anytime.",
    favoritesEmpty: "Nothing saved yet.",
    favoritesEmptyHint: "Heart a listing while you browse. Only you will see it here.",
    explorePlaces: "Explore experiences",
    unfavorite: "Remove favorite",
    bookingsTitle: "Bookings",
    bookingsBody: "Requests and confirmations stay on your account. They are never silently deleted.",
    bookingsEmpty: "No bookings yet.",
    bookingsEmptyHint: "Browse a listing and request a preview booking when you are ready.",
    browseToBook: "Browse listings",
    cancelBooking: "Cancel booking",
    cancelReason: "Why are you cancelling?",
    confirmCancel: "Cancel this booking",
    cancelled: "Cancelled",
    pending: "Pending",
    confirmed: "Confirmed",
    rejected: "Rejected",
    expired: "Expired",
    completed: "Completed",
    policySummary: "Policy",
    notificationsTitle: "Notifications",
    notificationsBody: "Updates about your trips and bookings.",
    notificationsEmpty: "No notifications.",
    notificationsEmptyHint: "Cancelling a booking or account updates will appear here.",
    markRead: "Mark as read",
    unread: "Unread",
    read: "Read",
    openItem: "Open related item",
    pageLabel: "Pagination",
    newTrip: "New trip",
    tripsKicker: "Good things to look forward to",
    favoritesKicker: "Kept for later",
    bookingsKicker: "Your reservations",
    notificationsKicker: "Stay in the loop",
    settingsKicker: "Your account",
    settingsTitle: "Settings",
    settingsBody: "Profile, preferences, messages and privacy — all in one place.",
    createdOn: "Created",
    openTrip: "Open plan",
    viewList: "List",
    viewCalendar: "Calendar",
    unscheduled: "Unscheduled",
    scheduledFor: "Scheduled for",
    planned: "Planned",
    allDays: "All days",
    noTripsDay: "No trips on this day.",
    statusDraft: "Planning",
    statusLocked: "Locked",
    statusArchived: "Archived",
    stopsOne: "{count} stop",
    stopsOther: "{count} stops",
    bookedOn: "Requested",
    checkoutBookings: "Checkout bookings",
    listingBookings: "Booking requests",
    unreadCount: "unread",
  },
  ar: {
    tripsTitle: "رحلاتك",
    tripsBody: "المسودات والخطط المقفلة والمؤرشفة — لك وحدك.",
    tripsEmpty: "لا رحلات بعد.",
    tripsEmptyHint: "ابدأ خطة وستظهر هنا مع حالتها.",
    planTrip: "خطّط لرحلة",
    archiveTrip: "أرشفة الرحلة",
    archived: "مؤرشفة",
    draft: "مسودة",
    locked: "مقفلة",
    favoritesTitle: "المفضلة",
    favoritesBody: "أماكن أبقيتها لوقت لاحق. يمكنك إزالتها في أي وقت.",
    favoritesEmpty: "لا شيء محفوظ بعد.",
    favoritesEmptyHint: "احفظ عرضاً أثناء التصفح. ستراه هنا وحدك.",
    explorePlaces: "استكشف التجارب",
    unfavorite: "إزالة من المفضلة",
    bookingsTitle: "الحجوزات",
    bookingsBody: "الطلبات والتأكيدات تبقى في حسابك. لا تُحذف بصمت.",
    bookingsEmpty: "لا حجوزات بعد.",
    bookingsEmptyHint: "تصفح عرضاً واطلب حجزاً تجريبياً عندما تكون جاهزاً.",
    browseToBook: "تصفح العروض",
    cancelBooking: "إلغاء الحجز",
    cancelReason: "لماذا تلغي؟",
    confirmCancel: "إلغاء هذا الحجز",
    cancelled: "ملغى",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    rejected: "مرفوض",
    expired: "منتهٍ",
    completed: "مكتمل",
    policySummary: "السياسة",
    notificationsTitle: "الإشعارات",
    notificationsBody: "تحديثات رحلاتك وحجوزاتك.",
    notificationsEmpty: "لا إشعارات.",
    notificationsEmptyHint: "إلغاء حجز أو تحديثات الحساب تظهر هنا.",
    markRead: "تعليم كمقروء",
    unread: "غير مقروء",
    read: "مقروء",
    openItem: "فتح العنصر المرتبط",
    pageLabel: "ترقيم الصفحات",
    newTrip: "رحلة جديدة",
    tripsKicker: "أشياء جميلة بانتظارك",
    favoritesKicker: "محفوظ لوقت لاحق",
    bookingsKicker: "حجوزاتك",
    notificationsKicker: "ابقَ على اطلاع",
    settingsKicker: "حسابك",
    settingsTitle: "الإعدادات",
    settingsBody: "الملف الشخصي والتفضيلات والرسائل والخصوصية في مكان واحد.",
    createdOn: "أُنشئت في",
    openTrip: "افتح الخطة",
    viewList: "قائمة",
    viewCalendar: "تقويم",
    unscheduled: "غير مجدولة",
    scheduledFor: "مجدولة ليوم",
    planned: "مخطّطة",
    allDays: "كل الأيام",
    noTripsDay: "لا رحلات في هذا اليوم.",
    statusDraft: "قيد التخطيط",
    statusLocked: "مقفلة",
    statusArchived: "مؤرشفة",
    stopsOne: "محطة واحدة",
    stopsOther: "{count} محطات",
    bookedOn: "طُلب في",
    checkoutBookings: "حجوزات الدفع",
    listingBookings: "طلبات الحجز",
    unreadCount: "غير مقروءة",
  },
  fr: {
    tripsTitle: "Vos voyages",
    tripsBody: "Brouillons, plans verrouillés et archives — uniquement les vôtres.",
    tripsEmpty: "Pas encore de voyage.",
    tripsEmptyHint: "Créez un plan. Il apparaîtra ici avec son statut.",
    planTrip: "Planifier un voyage",
    archiveTrip: "Archiver le voyage",
    archived: "Archivé",
    draft: "Brouillon",
    locked: "Verrouillé",
    favoritesTitle: "Favoris",
    favoritesBody: "Lieux gardés pour plus tard. Retirez-les quand vous voulez.",
    favoritesEmpty: "Rien d’enregistré.",
    favoritesEmptyHint: "Ajoutez une annonce en parcourant. Vous seul la verrez ici.",
    explorePlaces: "Explorer les expériences",
    unfavorite: "Retirer des favoris",
    bookingsTitle: "Réservations",
    bookingsBody: "Demandes et confirmations restent sur le compte. Elles ne sont jamais supprimées en silence.",
    bookingsEmpty: "Pas encore de réservation.",
    bookingsEmptyHint: "Parcourez une annonce et demandez une réservation aperçu quand vous êtes prêt.",
    browseToBook: "Parcourir les annonces",
    cancelBooking: "Annuler la réservation",
    cancelReason: "Pourquoi annulez-vous ?",
    confirmCancel: "Annuler cette réservation",
    cancelled: "Annulée",
    pending: "En attente",
    confirmed: "Confirmée",
    rejected: "Refusée",
    expired: "Expirée",
    completed: "Terminée",
    policySummary: "Politique",
    notificationsTitle: "Notifications",
    notificationsBody: "Actualités de vos voyages et réservations.",
    notificationsEmpty: "Aucune notification.",
    notificationsEmptyHint: "Une annulation ou une mise à jour de compte apparaîtra ici.",
    markRead: "Marquer comme lu",
    unread: "Non lu",
    read: "Lu",
    openItem: "Ouvrir l’élément lié",
    pageLabel: "Pagination",
    newTrip: "Nouveau voyage",
    tripsKicker: "De belles choses à venir",
    favoritesKicker: "Gardé pour plus tard",
    bookingsKicker: "Vos réservations",
    notificationsKicker: "Restez informé",
    settingsKicker: "Votre compte",
    settingsTitle: "Paramètres",
    settingsBody: "Profil, préférences, messages et confidentialité — au même endroit.",
    createdOn: "Créé le",
    openTrip: "Ouvrir le plan",
    viewList: "Liste",
    viewCalendar: "Calendrier",
    unscheduled: "Non planifié",
    scheduledFor: "Planifié pour",
    planned: "Planifié",
    allDays: "Tous les jours",
    noTripsDay: "Aucun voyage ce jour-là.",
    statusDraft: "Planification",
    statusLocked: "Verrouillé",
    statusArchived: "Archivé",
    stopsOne: "{count} étape",
    stopsOther: "{count} étapes",
    bookedOn: "Demandé le",
    checkoutBookings: "Réservations payées",
    listingBookings: "Demandes de réservation",
    unreadCount: "non lues",
  },
};

export function useHubCopy() {
  const { locale } = useLocale();
  return hubCopy[locale];
}
