import { useLocale } from "@/components/shell/locale-provider";
import type { Locale } from "@/lib/locale";

export type PrivacyKey =
  | "privacyTitle"
  | "privacyBody"
  | "exportTitle"
  | "exportBody"
  | "exportAction"
  | "exportDone"
  | "resetTitle"
  | "resetBody"
  | "resetAction"
  | "resetDone"
  | "deleteTitle"
  | "deleteBody"
  | "deleteConfirm"
  | "deleteAction"
  | "retentionTitle"
  | "retentionProfile"
  | "retentionTrips"
  | "retentionFavorites"
  | "retentionReviews"
  | "retentionBookings"
  | "retentionPayments"
  | "error";

export const privacyCopy: Record<Locale, Record<PrivacyKey, string>> = {
  en: {
    privacyTitle: "Your data",
    privacyBody:
      "Export what we hold, reset personalisation, or anonymise the account. Bookings and payments are never silently deleted.",
    exportTitle: "Download a copy",
    exportBody: "JSON of your profile, trips, favorites, reviews and bookings.",
    exportAction: "Download my data",
    exportDone: "Export started.",
    resetTitle: "Reset personalisation",
    resetBody: "Clears preferences and recommendation signals. Your name, email, trips and bookings stay.",
    resetAction: "Reset personalisation",
    resetDone: "Personalisation signals were cleared.",
    deleteTitle: "Delete account",
    deleteBody:
      "Anonymises your profile. Booking and accounting rows stay with an anonymised id so records remain auditable.",
    deleteConfirm: "Type DELETE to confirm",
    deleteAction: "Anonymise my account",
    retentionTitle: "What we keep",
    retentionProfile: "Profile: exported, reset to empty preferences, or anonymised on delete.",
    retentionTrips: "Trips: exported. Plan defaults clear on reset. Rows stay after delete.",
    retentionFavorites: "Favorites: exported. Removed when the account is anonymised.",
    retentionReviews: "Reviews: exported. Rows stay; the author becomes the anonymised user.",
    retentionBookings: "Bookings: exported. Never hard-deleted.",
    retentionPayments: "Payments and refunds: kept for accounting. Not in the traveller download.",
    error: "Could not complete that privacy request.",
  },
  ar: {
    privacyTitle: "بياناتك",
    privacyBody: "صدّر ما نحتفظ به، أو أعد ضبط التخصيص، أو اجعل الحساب مجهولاً. الحجوزات والمدفوعات لا تُحذف بصمت.",
    exportTitle: "نزّل نسخة",
    exportBody: "JSON لملفك ورحلاتك ومفضلتك ومراجعاتك وحجوزاتك.",
    exportAction: "تنزيل بياناتي",
    exportDone: "بدأ التصدير.",
    resetTitle: "إعادة ضبط التخصيص",
    resetBody: "يمسح التفضيلات وإشارات التوصية. الاسم والبريد والرحلات والحجوزات تبقى.",
    resetAction: "إعادة ضبط التخصيص",
    resetDone: "تم مسح إشارات التخصيص.",
    deleteTitle: "حذف الحساب",
    deleteBody: "يجعل ملفك مجهولاً. صفوف الحجز والمحاسبة تبقى بمعرّف مجهول.",
    deleteConfirm: "اكتب DELETE للتأكيد",
    deleteAction: "جعل حسابي مجهولاً",
    retentionTitle: "ما نحتفظ به",
    retentionProfile: "الملف: يُصدَّر، أو تُفرَّغ تفضيلاته، أو يُجهَّل عند الحذف.",
    retentionTrips: "الرحلات: تُصدَّر. تُمسح افتراضات الخطة عند الضبط. الصفوف تبقى بعد الحذف.",
    retentionFavorites: "المفضلة: تُصدَّر. تُحذف عند تجهيل الحساب.",
    retentionReviews: "المراجعات: تُصدَّر. الصفوف تبقى والمؤلف يصبح المستخدم المجهّل.",
    retentionBookings: "الحجوزات: تُصدَّر. لا تُحذف نهائياً.",
    retentionPayments: "المدفوعات والاستردادات: تُحفظ للمحاسبة. ليست في تنزيل المسافر.",
    error: "تعذّر إكمال طلب الخصوصية.",
  },
  fr: {
    privacyTitle: "Vos données",
    privacyBody:
      "Exportez ce que nous détenons, réinitialisez la personnalisation ou anonymisez le compte. Les réservations et paiements ne sont jamais supprimés en silence.",
    exportTitle: "Télécharger une copie",
    exportBody: "JSON de votre profil, voyages, favoris, avis et réservations.",
    exportAction: "Télécharger mes données",
    exportDone: "Export lancé.",
    resetTitle: "Réinitialiser la personnalisation",
    resetBody: "Efface les préférences et signaux. Nom, e-mail, voyages et réservations restent.",
    resetAction: "Réinitialiser la personnalisation",
    resetDone: "Les signaux de personnalisation ont été effacés.",
    deleteTitle: "Supprimer le compte",
    deleteBody:
      "Anonymise le profil. Les lignes de réservation et de comptabilité restent sous un identifiant anonymisé.",
    deleteConfirm: "Tapez DELETE pour confirmer",
    deleteAction: "Anonymiser mon compte",
    retentionTitle: "Ce que nous conservons",
    retentionProfile: "Profil : exporté, préférences vidées, ou anonymisé à la suppression.",
    retentionTrips: "Voyages : exportés. Les défauts du plan sont effacés. Les lignes restent après suppression.",
    retentionFavorites: "Favoris : exportés. Retirés à l’anonymisation.",
    retentionReviews: "Avis : exportés. Les lignes restent ; l’auteur devient l’utilisateur anonymisé.",
    retentionBookings: "Réservations : exportées. Jamais supprimées définitivement.",
    retentionPayments:
      "Paiements et remboursements : conservés pour la comptabilité. Absents du téléchargement voyageur.",
    error: "Impossible de terminer cette demande de confidentialité.",
  },
};

export function usePrivacyCopy() {
  const { locale } = useLocale();
  return privacyCopy[locale];
}
