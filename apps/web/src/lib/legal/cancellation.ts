import type { LegalLibrary } from "./types";

export const CANCELLATION_POLICY: LegalLibrary = {
  en: {
    title: "Cancellation policy",
    summary:
      "How cancelling works for travellers and businesses, how refunds are worked out, and what happens when plans change.",
    sections: [
      {
        id: "how-it-works",
        heading: "How cancellation works",
        body: [
          "Every listing shows its cancellation terms before you book. They say how much is refunded if you cancel at least a certain number of hours before the start, for example “full refund up to 48 hours before”.",
          "When you book, those terms are saved with your booking. If the business changes its terms later, your booking keeps the terms you agreed to.",
        ],
      },
      {
        id: "you-cancel",
        heading: "If you cancel",
        body: [
          {
            list: [
              "Cancel from My bookings and give a short reason. You will see the refund amount before you confirm.",
              "The refund is the best rate your saved terms allow at the moment you cancel. If no refund window still applies, no refund is due unless the business agrees to one.",
              "A full refund is issued straight away. A partial refund is sent for processing, then shown on your booking once it is paid back.",
              "Refunds go back to the original payment method. How quickly the money arrives depends on the payment provider and your bank.",
            ],
          },
        ],
      },
      {
        id: "holds-requests",
        heading: "Holds and requests",
        body: [
          {
            list: [
              "Instant bookings are held for 15 minutes while you pay. If you don't finish paying, the hold ends and nothing is charged.",
              "Booking requests that the business does not answer within 24 hours (or before the start, if sooner) lapse, and nothing is charged.",
              "You can withdraw a request at no cost until the business accepts it.",
            ],
          },
        ],
      },
      {
        id: "business-cancels",
        heading: "If the business cancels",
        body: [
          "If a business cancels a confirmed booking for any reason, you get a full refund, whatever the listing's cancellation terms say. The business must give a reason, and we may follow up with it. Businesses that cancel often may be limited or removed.",
        ],
      },
      {
        id: "no-shows",
        heading: "Late arrivals, no-shows and changes",
        body: [
          "If you arrive too late to take part, or don't come, this counts as a cancellation at the start time, so usually no refund is due. To change the date or party size, message the business from your booking; if the change isn't possible, you can cancel under your saved terms and book again.",
        ],
      },
      {
        id: "safety",
        heading: "Weather, safety and events outside anyone's control",
        body: [
          "If an experience cannot go ahead safely, because of severe weather, an official warning, a road closure or a security situation, the business should cancel it, and you get a full refund.",
          "If the experience goes ahead but you decide not to go, your saved terms apply. Many businesses will offer a new date or a refund anyway; contact them from your booking, and contact us if you need help.",
        ],
      },
      {
        id: "your-rights",
        heading: "Your rights under Lebanese law",
        body: [
          "This policy does not reduce any right you have under Lebanese Consumer Protection Law No. 659/2005, including its rules on contracts made at a distance. Where the law gives you a right to withdraw from a booking or to be refunded, we will apply it, even if the listing's terms say otherwise.",
          "If you are not satisfied, you can contact the Consumer Protection Directorate at the Ministry of Economy and Trade.",
        ],
      },
      {
        id: "help",
        heading: "Getting help",
        body: [
          "Start by messaging the business from your booking. If that doesn't solve it, contact us through {contact} with your booking reference, and we will look at it.",
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الإلغاء",
    summary: "كيف يتمّ الإلغاء للمسافرين والأنشطة التجارية، وكيف يُحتسب المبلغ المستردّ، وماذا يحدث عند تغيّر الخطط.",
    sections: [
      {
        id: "how-it-works",
        heading: "كيف يتمّ الإلغاء",
        body: [
          "تعرض كل تجربة شروط إلغائها قبل الحجز. وتحدّد هذه الشروط نسبة المبلغ المستردّ إذا ألغيت قبل موعد البدء بعدد معيّن من الساعات، مثل «استرداد كامل حتى 48 ساعة قبل الموعد».",
          "عند الحجز تُحفظ هذه الشروط مع حجزك. وإذا عدّل النشاط التجاري شروطه لاحقًا، يبقى حجزك خاضعًا للشروط التي وافقت عليها.",
        ],
      },
      {
        id: "you-cancel",
        heading: "إذا ألغيت أنت",
        body: [
          {
            list: [
              "ألغِ الحجز من صفحة «حجوزاتي» مع ذكر سبب مختصر، وسترى المبلغ المستردّ قبل التأكيد.",
              "يكون المبلغ المستردّ أفضل نسبة تسمح بها شروطك المحفوظة لحظة الإلغاء. وإذا لم تعد أي مهلة استرداد سارية، فلا يُستحق أي مبلغ ما لم يوافق النشاط التجاري على ذلك.",
              "يُصرف الاسترداد الكامل فورًا، أما الاسترداد الجزئي فيُحال إلى المعالجة ثم يظهر في حجزك عند إتمامه.",
              "تُعاد المبالغ إلى وسيلة الدفع الأصلية، وتتوقّف سرعة وصولها على مزوّد الدفع ومصرفك.",
            ],
          },
        ],
      },
      {
        id: "holds-requests",
        heading: "الحجز المؤقت وطلبات الحجز",
        body: [
          {
            list: [
              "يُحجز مكانك في الحجز الفوري لمدة 15 دقيقة ريثما تدفع. وإذا لم تُكمل الدفع تنتهي المهلة ولا يُقتطع أي مبلغ.",
              "طلبات الحجز التي لا يردّ عليها النشاط التجاري خلال 24 ساعة (أو قبل موعد البدء إن كان أقرب) تسقط، ولا يُقتطع أي مبلغ.",
              "يمكنك سحب طلبك دون أي كلفة إلى أن يقبله النشاط التجاري.",
            ],
          },
        ],
      },
      {
        id: "business-cancels",
        heading: "إذا ألغى النشاط التجاري",
        body: [
          "إذا ألغى النشاط التجاري حجزًا مؤكَّدًا لأي سبب، تستردّ المبلغ كاملًا أيًّا كانت شروط الإلغاء المعروضة. ويجب على النشاط التجاري ذكر السبب، وقد نتابع الأمر معه. وقد تُقيَّد الأنشطة التجارية التي تُكثر من الإلغاء أو تُزال من المنصة.",
        ],
      },
      {
        id: "no-shows",
        heading: "التأخّر وعدم الحضور والتعديلات",
        body: [
          "إذا وصلت متأخرًا بحيث لا يمكنك المشاركة، أو لم تحضر، يُعدّ ذلك إلغاءً عند موعد البدء، وعادةً لا يُستحق أي استرداد. لتغيير التاريخ أو عدد الأشخاص، راسل النشاط التجاري من صفحة الحجز؛ وإذا تعذّر التعديل يمكنك الإلغاء وفق شروطك المحفوظة ثم الحجز من جديد.",
        ],
      },
      {
        id: "safety",
        heading: "الطقس والسلامة والظروف الخارجة عن السيطرة",
        body: [
          "إذا تعذّر تنظيم التجربة بأمان بسبب طقس شديد أو تحذير رسمي أو إغلاق طريق أو وضع أمني، ينبغي للنشاط التجاري إلغاؤها، وتستردّ المبلغ كاملًا.",
          "إذا نُظّمت التجربة لكنك قرّرت عدم الذهاب، تسري شروطك المحفوظة. وكثير من الأنشطة التجارية تعرض موعدًا بديلًا أو استردادًا في هذه الحالات؛ تواصل معها من صفحة الحجز، وتواصل معنا إن احتجت إلى مساعدة.",
        ],
      },
      {
        id: "your-rights",
        heading: "حقوقك بموجب القانون اللبناني",
        body: [
          "لا تنتقص هذه السياسة من أي حق لك بموجب قانون حماية المستهلك اللبناني رقم 659/2005، بما في ذلك أحكامه المتعلقة بالتعاقد عن بُعد. وحيثما يمنحك القانون حق العدول عن الحجز أو استرداد المبلغ، سنطبّقه حتى لو نصّت شروط التجربة على خلاف ذلك.",
          "إذا لم تكن راضيًا، يمكنك مراجعة مديرية حماية المستهلك في وزارة الاقتصاد والتجارة.",
        ],
      },
      {
        id: "help",
        heading: "الحصول على المساعدة",
        body: [
          "ابدأ بمراسلة النشاط التجاري من صفحة الحجز. وإذا لم تُحلّ المشكلة، تواصل معنا عبر {contact} مع ذكر رقم الحجز، وسنتابع الأمر.",
        ],
      },
    ],
  },
  fr: {
    title: "Politique d’annulation",
    summary:
      "Comment fonctionne l’annulation pour les voyageurs et les entreprises, comment les remboursements sont calculés et ce qui se passe quand les plans changent.",
    sections: [
      {
        id: "how-it-works",
        heading: "Fonctionnement de l’annulation",
        body: [
          "Chaque offre affiche ses conditions d’annulation avant la réservation. Elles indiquent la part remboursée si vous annulez au moins un certain nombre d’heures avant le début, par exemple « remboursement intégral jusqu’à 48 heures avant ».",
          "Au moment de la réservation, ces conditions sont enregistrées avec celle-ci. Si l’entreprise les modifie ensuite, votre réservation conserve les conditions que vous avez acceptées.",
        ],
      },
      {
        id: "you-cancel",
        heading: "Si vous annulez",
        body: [
          {
            list: [
              "Annulez depuis Mes réservations en indiquant un bref motif. Le montant remboursé s’affiche avant la confirmation.",
              "Le remboursement correspond au meilleur taux permis par vos conditions enregistrées au moment de l’annulation. Si aucun délai de remboursement ne s’applique plus, aucun remboursement n’est dû, sauf accord de l’entreprise.",
              "Un remboursement intégral est émis immédiatement. Un remboursement partiel est transmis pour traitement, puis apparaît sur votre réservation une fois versé.",
              "Les remboursements sont versés sur le moyen de paiement d’origine. Le délai de réception dépend du prestataire de paiement et de votre banque.",
            ],
          },
        ],
      },
      {
        id: "holds-requests",
        heading: "Places bloquées et demandes",
        body: [
          {
            list: [
              "Les réservations instantanées sont bloquées pendant 15 minutes le temps du paiement. Si vous ne terminez pas le paiement, le blocage prend fin et rien n’est débité.",
              "Les demandes auxquelles l’entreprise ne répond pas sous 24 heures (ou avant le début, si celui-ci est plus proche) deviennent caduques, et rien n’est débité.",
              "Vous pouvez retirer une demande sans frais tant que l’entreprise ne l’a pas acceptée.",
            ],
          },
        ],
      },
      {
        id: "business-cancels",
        heading: "Si l’entreprise annule",
        body: [
          "Si une entreprise annule une réservation confirmée, pour quelque raison que ce soit, vous êtes remboursé intégralement, quelles que soient les conditions d’annulation de l’offre. L’entreprise doit indiquer un motif et nous pouvons assurer un suivi auprès d’elle. Les entreprises qui annulent souvent peuvent être limitées ou retirées.",
        ],
      },
      {
        id: "no-shows",
        heading: "Retards, absences et modifications",
        body: [
          "Si vous arrivez trop tard pour participer ou ne vous présentez pas, cela compte comme une annulation à l’heure de début ; en général, aucun remboursement n’est dû. Pour changer la date ou le nombre de participants, écrivez à l’entreprise depuis votre réservation ; si ce n’est pas possible, vous pouvez annuler selon vos conditions enregistrées et réserver à nouveau.",
        ],
      },
      {
        id: "safety",
        heading: "Météo, sécurité et événements imprévisibles",
        body: [
          "Si une expérience ne peut pas avoir lieu en sécurité (intempéries graves, alerte officielle, route fermée ou situation sécuritaire), l’entreprise doit l’annuler et vous êtes remboursé intégralement.",
          "Si l’expérience a lieu mais que vous décidez de ne pas y aller, vos conditions enregistrées s’appliquent. De nombreuses entreprises proposent tout de même une nouvelle date ou un remboursement ; contactez-les depuis votre réservation, et contactez-nous si vous avez besoin d’aide.",
        ],
      },
      {
        id: "your-rights",
        heading: "Vos droits selon la loi libanaise",
        body: [
          "Cette politique ne réduit aucun des droits que vous tirez de la loi libanaise n° 659/2005 sur la protection du consommateur, y compris ses règles sur les contrats à distance. Lorsque la loi vous donne le droit de vous rétracter ou d’être remboursé, nous l’appliquons, même si les conditions de l’offre disent autre chose.",
          "Si vous n’êtes pas satisfait, vous pouvez vous adresser à la Direction de la protection du consommateur du ministère de l’Économie et du Commerce.",
        ],
      },
      {
        id: "help",
        heading: "Obtenir de l’aide",
        body: [
          "Commencez par écrire à l’entreprise depuis votre réservation. Si le problème persiste, contactez-nous via {contact} en indiquant la référence de votre réservation, et nous l’examinerons.",
        ],
      },
    ],
  },
};
