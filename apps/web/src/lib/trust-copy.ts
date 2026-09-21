import { useLocale } from "@/components/shell/locale-provider";
import type { Locale } from "@/lib/locale";

/** Copy for the trust documents, consent controls and cookie choices (MSHWAR-113). */
export type TrustKey =
  | "legalVersion"
  | "legalEffective"
  | "legalDraft"
  | "legalContents"
  | "legalRelated"
  | "legalManageData"
  | "cancellationLink"
  | "communityLink"
  | "cookieSettings"
  | "cookieTitle"
  | "cookieBody"
  | "cookieEssentialOnly"
  | "cookieAllowAll"
  | "cookieChoose"
  | "cookieSave"
  | "cookieEssential"
  | "cookieEssentialBody"
  | "cookieAlwaysOn"
  | "cookieErrors"
  | "cookieErrorsBody"
  | "cookieMaps"
  | "cookieMapsBody"
  | "cookiePolicyLink"
  | "cookieSaved"
  | "mapOffTitle"
  | "mapOffBody"
  | "mapAllow"
  | "acceptLead"
  | "acceptJoin"
  | "acceptEnd"
  | "termsLink"
  | "privacyLink"
  | "acceptRequired"
  | "signupPersonalisation"
  | "signupMarketing"
  | "signupOptional"
  | "policyUpdateTitle"
  | "policyUpdateBody"
  | "policyAccept"
  | "policyError"
  | "personalisationTitle"
  | "personalisationBody"
  | "personalisationToggle"
  | "personalisationOn"
  | "personalisationOff"
  | "personalisationOffNotice"
  | "personalisationTurnOn"
  | "purposeTerms"
  | "purposePrivacy"
  | "purposePersonalisation"
  | "purposeMarketingEmail"
  | "purposeMarketingInApp"
  | "purposeTraining";

export const trustCopy: Record<Locale, Record<TrustKey, string>> = {
  en: {
    legalVersion: "Version",
    legalEffective: "In effect from",
    legalDraft: "Draft pending legal review. This text may still change.",
    legalContents: "On this page",
    legalRelated: "Related documents",
    legalManageData: "Manage your data",
    cancellationLink: "Cancellation policy",
    communityLink: "Community guidelines",
    cookieSettings: "Cookie settings",
    cookieTitle: "Cookies on Mshwar",
    cookieBody:
      "Essential cookies keep you signed in and remember your language. With your permission we also use error reporting and embedded maps.",
    cookieEssentialOnly: "Essential only",
    cookieAllowAll: "Allow all",
    cookieChoose: "Choose",
    cookieSave: "Save choices",
    cookieEssential: "Essential",
    cookieEssentialBody: "Sign-in, language and your cookie choices.",
    cookieAlwaysOn: "Always on",
    cookieErrors: "Error reporting",
    cookieErrorsBody:
      "Sends details of errors in your browser to our monitoring service, with personal details removed.",
    cookieMaps: "Maps and embedded content",
    cookieMapsBody: "Loads Google Maps, which may set its own cookies.",
    cookiePolicyLink: "How we use cookies",
    cookieSaved: "Your cookie choices were saved.",
    mapOffTitle: "The map is off",
    mapOffBody: "Maps are provided by Google, which may set its own cookies. Allow maps to show it here.",
    mapAllow: "Allow maps",
    acceptLead: "I agree to the",
    acceptJoin: "and the",
    acceptEnd: ".",
    termsLink: "terms of service",
    privacyLink: "privacy policy",
    acceptRequired: "Please accept the terms of service and privacy policy to create an account.",
    signupPersonalisation: "Use my saved preferences and activity to personalise plans",
    signupMarketing: "Send me travel ideas and offers by email",
    signupOptional: "Optional. You can change these at any time in Settings.",
    policyUpdateTitle: "We’ve updated our terms and privacy policy.",
    policyUpdateBody: "Please read them and accept to keep using your account.",
    policyAccept: "Accept",
    policyError: "We couldn’t save that. Please reload the page and try again.",
    personalisationTitle: "Personalisation",
    personalisationBody:
      "Use your saved preferences and activity to shape plans and suggestions. When it’s off, plans ignore them, but they stay saved.",
    personalisationToggle: "Personalise my plans",
    personalisationOn: "Personalisation is on.",
    personalisationOff: "Personalisation is off.",
    personalisationOffNotice: "Personalisation is off, so these preferences won’t shape your plans.",
    personalisationTurnOn: "Turn on personalisation",
    purposeTerms: "Terms of service",
    purposePrivacy: "Privacy policy",
    purposePersonalisation: "Personalisation",
    purposeMarketingEmail: "Marketing emails",
    purposeMarketingInApp: "In-app offers",
    purposeTraining: "Improving suggestions",
  },
  ar: {
    legalVersion: "الإصدار",
    legalEffective: "ساري المفعول اعتبارًا من",
    legalDraft: "مسودة قيد المراجعة القانونية، وقد يتغيّر هذا النص.",
    legalContents: "في هذه الصفحة",
    legalRelated: "مستندات ذات صلة",
    legalManageData: "إدارة بياناتك",
    cancellationLink: "سياسة الإلغاء",
    communityLink: "إرشادات المجتمع",
    cookieSettings: "إعدادات ملفات تعريف الارتباط",
    cookieTitle: "ملفات تعريف الارتباط على مشوار",
    cookieBody:
      "تحافظ ملفات تعريف الارتباط الأساسية على تسجيل دخولك وتتذكّر لغتك. وبإذنك نستخدم أيضًا الإبلاغ عن الأخطاء والخرائط المضمّنة.",
    cookieEssentialOnly: "الأساسية فقط",
    cookieAllowAll: "السماح بالكل",
    cookieChoose: "اختيار",
    cookieSave: "حفظ الاختيارات",
    cookieEssential: "أساسية",
    cookieEssentialBody: "تسجيل الدخول واللغة واختياراتك لملفات تعريف الارتباط.",
    cookieAlwaysOn: "مفعّلة دائمًا",
    cookieErrors: "الإبلاغ عن الأخطاء",
    cookieErrorsBody: "يرسل تفاصيل الأخطاء التي تحدث في متصفحك إلى خدمة المراقبة لدينا بعد إزالة البيانات الشخصية.",
    cookieMaps: "الخرائط والمحتوى المضمّن",
    cookieMapsBody: "يحمّل خرائط Google التي قد تضع ملفات تعريف ارتباط خاصة بها.",
    cookiePolicyLink: "كيف نستخدم ملفات تعريف الارتباط",
    cookieSaved: "حُفظت اختياراتك لملفات تعريف الارتباط.",
    mapOffTitle: "الخريطة متوقفة",
    mapOffBody: "توفّر Google الخرائط وقد تضع ملفات تعريف ارتباط خاصة بها. اسمح بالخرائط لعرضها هنا.",
    mapAllow: "السماح بالخرائط",
    acceptLead: "أوافق على",
    acceptJoin: "و",
    acceptEnd: ".",
    termsLink: "شروط الخدمة",
    privacyLink: "سياسة الخصوصية",
    acceptRequired: "يُرجى قبول شروط الخدمة وسياسة الخصوصية لإنشاء حساب.",
    signupPersonalisation: "استخدم تفضيلاتي المحفوظة ونشاطي لتخصيص الخطط",
    signupMarketing: "أرسلوا إليّ أفكار رحلات وعروضًا عبر البريد الإلكتروني",
    signupOptional: "اختياري، ويمكنك تغييره في أي وقت من الإعدادات.",
    policyUpdateTitle: "حدّثنا شروط الخدمة وسياسة الخصوصية.",
    policyUpdateBody: "يُرجى قراءتهما وقبولهما لمتابعة استخدام حسابك.",
    policyAccept: "قبول",
    policyError: "تعذّر حفظ ذلك. يُرجى إعادة تحميل الصفحة والمحاولة مجددًا.",
    personalisationTitle: "التخصيص",
    personalisationBody:
      "استخدام تفضيلاتك المحفوظة ونشاطك لتشكيل الخطط والاقتراحات. عند إيقافه تتجاهلها الخطط، لكنها تبقى محفوظة.",
    personalisationToggle: "تخصيص خططي",
    personalisationOn: "التخصيص مفعّل.",
    personalisationOff: "التخصيص متوقف.",
    personalisationOffNotice: "التخصيص متوقف، لذلك لن تؤثّر هذه التفضيلات في خططك.",
    personalisationTurnOn: "تفعيل التخصيص",
    purposeTerms: "شروط الخدمة",
    purposePrivacy: "سياسة الخصوصية",
    purposePersonalisation: "التخصيص",
    purposeMarketingEmail: "الرسائل التسويقية",
    purposeMarketingInApp: "العروض داخل التطبيق",
    purposeTraining: "تحسين الاقتراحات",
  },
  fr: {
    legalVersion: "Version",
    legalEffective: "En vigueur depuis le",
    legalDraft: "Projet en attente de relecture juridique. Ce texte peut encore changer.",
    legalContents: "Sur cette page",
    legalRelated: "Documents associés",
    legalManageData: "Gérer vos données",
    cancellationLink: "Politique d’annulation",
    communityLink: "Règles de la communauté",
    cookieSettings: "Paramètres des cookies",
    cookieTitle: "Les cookies sur Mshwar",
    cookieBody:
      "Les cookies essentiels vous gardent connecté et mémorisent votre langue. Avec votre accord, nous utilisons aussi le signalement d’erreurs et les cartes intégrées.",
    cookieEssentialOnly: "Essentiels uniquement",
    cookieAllowAll: "Tout autoriser",
    cookieChoose: "Choisir",
    cookieSave: "Enregistrer mes choix",
    cookieEssential: "Essentiels",
    cookieEssentialBody: "Connexion, langue et vos choix de cookies.",
    cookieAlwaysOn: "Toujours actifs",
    cookieErrors: "Signalement d’erreurs",
    cookieErrorsBody:
      "Envoie les détails des erreurs survenues dans votre navigateur à notre service de suivi, sans données personnelles.",
    cookieMaps: "Cartes et contenus intégrés",
    cookieMapsBody: "Charge Google Maps, qui peut déposer ses propres cookies.",
    cookiePolicyLink: "Notre usage des cookies",
    cookieSaved: "Vos choix de cookies ont été enregistrés.",
    mapOffTitle: "La carte est désactivée",
    mapOffBody:
      "Les cartes sont fournies par Google, qui peut déposer ses propres cookies. Autorisez les cartes pour l’afficher ici.",
    mapAllow: "Autoriser les cartes",
    acceptLead: "J’accepte les",
    acceptJoin: "et la",
    acceptEnd: ".",
    termsLink: "conditions d’utilisation",
    privacyLink: "politique de confidentialité",
    acceptRequired:
      "Veuillez accepter les conditions d’utilisation et la politique de confidentialité pour créer un compte.",
    signupPersonalisation: "Utiliser mes préférences enregistrées et mon activité pour personnaliser les plans",
    signupMarketing: "M’envoyer des idées de voyage et des offres par e-mail",
    signupOptional: "Facultatif. Modifiable à tout moment dans les Paramètres.",
    policyUpdateTitle: "Nous avons mis à jour nos conditions et notre politique de confidentialité.",
    policyUpdateBody: "Merci de les lire et de les accepter pour continuer à utiliser votre compte.",
    policyAccept: "Accepter",
    policyError: "Enregistrement impossible. Rechargez la page et réessayez.",
    personalisationTitle: "Personnalisation",
    personalisationBody:
      "Utiliser vos préférences enregistrées et votre activité pour adapter les plans et suggestions. Désactivée, les plans les ignorent, mais elles restent enregistrées.",
    personalisationToggle: "Personnaliser mes plans",
    personalisationOn: "La personnalisation est activée.",
    personalisationOff: "La personnalisation est désactivée.",
    personalisationOffNotice: "La personnalisation est désactivée : ces préférences n’influencent pas vos plans.",
    personalisationTurnOn: "Activer la personnalisation",
    purposeTerms: "Conditions d’utilisation",
    purposePrivacy: "Politique de confidentialité",
    purposePersonalisation: "Personnalisation",
    purposeMarketingEmail: "E-mails marketing",
    purposeMarketingInApp: "Offres dans l’application",
    purposeTraining: "Amélioration des suggestions",
  },
};

export function useTrustCopy() {
  const { locale } = useLocale();
  return trustCopy[locale];
}

const PURPOSE_KEYS: Record<string, TrustKey> = {
  terms: "purposeTerms",
  privacy: "purposePrivacy",
  personalisation: "purposePersonalisation",
  marketing_email: "purposeMarketingEmail",
  marketing_in_app: "purposeMarketingInApp",
  training: "purposeTraining",
};

/** Human label for a consent purpose; unknown purposes are shown as sent. */
export function purposeLabel(copy: Record<TrustKey, string>, purpose: string): string {
  const key = PURPOSE_KEYS[purpose];
  return key ? copy[key] : purpose;
}
