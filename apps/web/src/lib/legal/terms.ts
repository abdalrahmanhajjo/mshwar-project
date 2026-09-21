import type { LegalLibrary } from "./types";

export const TERMS_OF_SERVICE: LegalLibrary = {
  en: {
    title: "Terms of service",
    summary:
      "The rules for using Mshwar to plan trips, book experiences and run a business listing, and what you and we can expect from each other.",
    sections: [
      {
        id: "about",
        heading: "About these terms",
        body: [
          "Mshwar is operated by {entity}, {address} (“Mshwar”, “we”). These terms apply when you use the Mshwar website or app. By creating an account you agree to them, together with our privacy policy, cancellation policy and community guidelines.",
          "Each version has a date. You can reach us about these terms through {contact}.",
        ],
      },
      {
        id: "accounts",
        heading: "Your account",
        body: [
          {
            list: [
              "You must be 18 or over to create an account.",
              "Give accurate details and keep them up to date. Bookings and receipts use the name and email on your account.",
              "Keep your password private. You are responsible for what happens in your account unless it was used without your permission and you tell us promptly.",
              "One account per person. Business staff use their own personal accounts, linked to the business with a role.",
            ],
          },
        ],
      },
      {
        id: "our-role",
        heading: "What Mshwar does",
        body: [
          "Mshwar is a marketplace. We help you discover and plan experiences in Lebanon, and we let independent businesses list and sell them. The business that runs an experience is the one providing it, and your booking creates an agreement between you and that business.",
          "We run the platform, show each listing's price and terms before you commit, handle payments through our payment provider, and help when something goes wrong. We check businesses before they can take bookings, but we do not run the experiences ourselves.",
        ],
      },
      {
        id: "planner",
        heading: "AI plans and suggestions",
        body: [
          "The trip planner uses automated tools to suggest itineraries. A plan is a suggestion, not a booking or a promise that a place is open, available or suitable for you. Check opening hours, travel conditions, official safety advice and each listing's terms before you rely on a plan.",
          "Don't type other people's sensitive personal details into the planner.",
        ],
      },
      {
        id: "booking",
        heading: "Booking an experience",
        body: [
          "Each listing shows how it is booked:",
          {
            list: [
              "Instant booking: your place is held for 15 minutes while you pay. If payment is required, the booking is confirmed only after the payment succeeds. If the hold expires, nothing is charged.",
              "Booking request: the business must accept. It has 24 hours to answer, or until the experience starts if that is sooner. If it does not answer in time, the request lapses and nothing is charged.",
              "Inquiry: a message to the business. It does not reserve a place or commit you to anything.",
            ],
          },
          "Check the date, time, party size, meeting point, what is included and any requirements (such as age or fitness) before you confirm. Tell the business about anything it needs to know to run the experience safely.",
        ],
      },
      {
        id: "prices",
        heading: "Prices and payment",
        body: [
          "The full price, the currency and what the price includes are shown before you pay. Where Lebanese law requires a price in Lebanese pounds, it is shown too. Extra costs not shown at checkout cannot be charged through Mshwar.",
          "Payments are processed by our payment provider. We never receive your full card number. Refunds go back to the original payment method.",
        ],
      },
      {
        id: "cancellations",
        heading: "Cancellations and refunds",
        body: [
          "The cancellation terms shown on the listing when you book are saved with your booking; later changes to the listing do not affect you. If the business cancels, you get a full refund. The details are in our cancellation policy.",
        ],
      },
      {
        id: "businesses",
        heading: "Businesses on Mshwar",
        body: [
          "If you list experiences on Mshwar, you also agree to:",
          {
            list: [
              "complete verification and keep your organisation's details, licences and insurance current, as Lebanese law and your activity require;",
              "describe each experience, price, meeting point and cancellation terms accurately, and use only photos you have the right to use;",
              "honour confirmed bookings, answer booking requests on time, and give a reason if you have to cancel;",
              "use guests' personal data only to deliver their booking and to meet your legal duties, and keep it secure;",
              "give staff only the roles they need and remove access when someone leaves;",
              "not contact guests to move a booking or payment off Mshwar.",
            ],
          },
          "Business fees and payout terms are agreed separately in the business portal.",
        ],
      },
      {
        id: "content",
        heading: "Reviews and other content",
        body: [
          "You keep ownership of the reviews, photos and messages you post. You give Mshwar a non-exclusive, royalty-free licence to host, show and translate them on the platform and to promote the platform, for as long as they stay on Mshwar and as needed afterwards for records.",
          "Content must follow our community guidelines. We may hide or remove content that breaks them, and we keep a record of moderation decisions. Businesses cannot edit, hide or delete reviews; they can reply or report them.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "Acceptable use",
        body: [
          "Don't use Mshwar to:",
          {
            list: [
              "break Lebanese law or anyone's rights;",
              "create fake accounts, listings, bookings or reviews, or commit fraud;",
              "copy or scrape listings or data in bulk, or get around rate limits and usage allowances;",
              "probe, scan or test the security of Mshwar without our written permission (report vulnerabilities to us instead);",
              "upload malware, or files you don't have the right to share;",
              "harass other people or share their personal details.",
            ],
          },
        ],
      },
      {
        id: "group-trips",
        heading: "Group trips and share links",
        body: [
          "Anyone with a trip's share or invite link can see the trip and, if you allow it, join and vote. Share links only with people you trust, and revoke a link if it reaches the wrong people. Each person who books pays for and is responsible for their own booking unless the booking says otherwise.",
        ],
      },
      {
        id: "liability",
        heading: "Responsibility and liability",
        body: [
          "The business that runs an experience is responsible for delivering it safely and as described. We are responsible for running the platform with reasonable care and skill.",
          "As far as Lebanese law allows, we are not liable for indirect losses, or for losses caused by events outside our reasonable control, such as network outages, strikes, security incidents in the area or official closures.",
          "Nothing in these terms limits liability for fraud, intentional wrongdoing or gross negligence, or removes rights you have under Lebanese Consumer Protection Law No. 659/2005 or other laws that cannot be excluded by contract.",
        ],
      },
      {
        id: "suspension",
        heading: "Suspending or closing accounts",
        body: [
          "You can delete your account at any time from Settings. We may limit, suspend or close an account that breaks these terms, puts others at risk or is needed to meet a legal duty. Where we can, we will tell you why and give you a chance to respond. Bookings already confirmed will be handled fairly, including refunds where they are due.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        body: [
          "We may update these terms when the service or the law changes. For important changes, we will tell you in the app and ask you to accept the new version before you continue using your account. Changes do not affect bookings already made.",
        ],
      },
      {
        id: "law",
        heading: "Governing law and disputes",
        body: [
          "These terms are governed by Lebanese law. If you have a problem, please contact us first through {contact}; most issues can be solved quickly.",
          "As a consumer you can also contact the Consumer Protection Directorate at the Ministry of Economy and Trade. Any dispute we cannot settle together goes to the competent courts in Lebanon, without affecting any other forum the law gives you.",
        ],
      },
    ],
  },
  ar: {
    title: "شروط الخدمة",
    summary:
      "القواعد التي تنظّم استخدام مشوار للتخطيط للرحلات وحجز التجارب وإدارة صفحة نشاط تجاري، وما يمكن أن يتوقّعه كلٌّ منّا من الآخر.",
    sections: [
      {
        id: "about",
        heading: "حول هذه الشروط",
        body: [
          "تُشغّل منصةَ مشوار الجهةُ {entity}، {address} (ويُشار إليها بـ«مشوار» أو «نحن»). تسري هذه الشروط عند استخدامك موقع مشوار أو تطبيقه. بإنشائك حسابًا فإنك توافق عليها، وعلى سياسة الخصوصية وسياسة الإلغاء وإرشادات المجتمع.",
          "لكل إصدار تاريخ خاص به. يمكنك التواصل معنا بشأن هذه الشروط عبر {contact}.",
        ],
      },
      {
        id: "accounts",
        heading: "حسابك",
        body: [
          {
            list: [
              "يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب.",
              "قدّم بيانات صحيحة وحدّثها عند تغيّرها، إذ يُستخدم الاسم والبريد الإلكتروني المسجّلان في حسابك في الحجوزات والإيصالات.",
              "حافظ على سرية كلمة المرور. أنت مسؤول عمّا يجري في حسابك، إلا إذا استُخدم دون إذنك وأبلغتنا بذلك فورًا.",
              "حساب واحد لكل شخص. يستخدم موظفو الأنشطة التجارية حساباتهم الشخصية المرتبطة بالنشاط التجاري بحسب الدور المُسند إليهم.",
            ],
          },
        ],
      },
      {
        id: "our-role",
        heading: "دور مشوار",
        body: [
          "مشوار سوقٌ إلكترونية تساعدك على اكتشاف التجارب في لبنان والتخطيط لها، وتتيح للأنشطة التجارية المستقلة عرضها وبيعها. النشاط التجاري الذي ينظّم التجربة هو مقدّمها، وينشأ عن حجزك اتفاق بينك وبينه.",
          "نحن نشغّل المنصة، ونعرض سعر كل تجربة وشروطها قبل أن تلتزم، ونعالج المدفوعات عبر مزوّد الدفع، ونساعدك عند حدوث مشكلة. نتحقّق من الأنشطة التجارية قبل السماح لها بتلقّي الحجوزات، لكننا لا ننظّم التجارب بأنفسنا.",
        ],
      },
      {
        id: "planner",
        heading: "خطط الذكاء الاصطناعي والاقتراحات",
        body: [
          "يستخدم مخطِّط الرحلات أدوات آلية لاقتراح برامج الرحلات. الخطة اقتراح فقط، وليست حجزًا ولا ضمانًا بأن المكان مفتوح أو متاح أو مناسب لك. تحقّق من ساعات العمل وظروف التنقّل وإرشادات السلامة الرسمية وشروط كل تجربة قبل الاعتماد على الخطة.",
          "لا تُدخل في المخطِّط بيانات شخصية حساسة تخصّ أشخاصًا آخرين.",
        ],
      },
      {
        id: "booking",
        heading: "حجز تجربة",
        body: [
          "توضّح كل صفحة تجربة طريقة حجزها:",
          {
            list: [
              "الحجز الفوري: يُحجز مكانك لمدة 15 دقيقة ريثما تُتمّ الدفع. إذا كان الدفع مطلوبًا فلا يُؤكَّد الحجز إلا بعد نجاح الدفع. وإذا انتهت المهلة فلن يُقتطع أي مبلغ.",
              "طلب الحجز: يجب أن يوافق النشاط التجاري على الطلب خلال 24 ساعة، أو قبل بدء التجربة إن كان ذلك أقرب. إذا لم يُجب في الوقت المحدّد يسقط الطلب ولا يُقتطع أي مبلغ.",
              "الاستفسار: رسالة إلى النشاط التجاري لا تحجز مكانًا ولا تُلزمك بشيء.",
            ],
          },
          "تحقّق من التاريخ والوقت وعدد الأشخاص ونقطة اللقاء وما يشمله السعر وأي متطلبات (كالعمر أو اللياقة البدنية) قبل التأكيد، وأبلغ النشاط التجاري بكل ما يلزمه لتنظيم التجربة بأمان.",
        ],
      },
      {
        id: "prices",
        heading: "الأسعار والدفع",
        body: [
          "يُعرض السعر الكامل والعملة وما يشمله السعر قبل الدفع. وحيث يوجب القانون اللبناني عرض السعر بالليرة اللبنانية، يُعرض كذلك. لا يجوز تحصيل أي تكاليف إضافية عبر مشوار إذا لم تُعرض عند الدفع.",
          "يعالج مزوّد الدفع المدفوعات، ولا نتلقّى رقم بطاقتك كاملًا في أي وقت. تُعاد المبالغ المستردّة إلى وسيلة الدفع الأصلية.",
        ],
      },
      {
        id: "cancellations",
        heading: "الإلغاء واسترداد المبالغ",
        body: [
          "تُحفظ شروط الإلغاء المعروضة عند الحجز مع حجزك، ولا تؤثّر فيك أي تعديلات لاحقة عليها. إذا ألغى النشاط التجاري الحجز تستردّ المبلغ كاملًا. التفاصيل واردة في سياسة الإلغاء.",
        ],
      },
      {
        id: "businesses",
        heading: "الأنشطة التجارية على مشوار",
        body: [
          "إذا عرضت تجاربك على مشوار فإنك توافق أيضًا على ما يلي:",
          {
            list: [
              "إتمام التحقّق، والحفاظ على بيانات مؤسستك وتراخيصها وتأمينها محدّثةً وفق ما يفرضه القانون اللبناني وطبيعة نشاطك؛",
              "وصف كل تجربة وسعرها ونقطة اللقاء وشروط الإلغاء بدقة، واستخدام الصور التي يحقّ لك استخدامها فقط؛",
              "الوفاء بالحجوزات المؤكَّدة، والرد على طلبات الحجز في الوقت المحدّد، وبيان السبب عند اضطرارك إلى الإلغاء؛",
              "استخدام البيانات الشخصية للضيوف فقط لتنفيذ حجوزاتهم والوفاء بالتزاماتك القانونية، والحفاظ على أمنها؛",
              "منح الموظفين الأدوار التي يحتاجون إليها فقط، وإلغاء صلاحية من يغادر؛",
              "عدم التواصل مع الضيوف لنقل الحجز أو الدفع إلى خارج مشوار.",
            ],
          },
          "يُتّفق على رسوم الأنشطة التجارية وشروط تحويل المستحقات بشكل منفصل في بوابة الأعمال.",
        ],
      },
      {
        id: "content",
        heading: "التقييمات والمحتوى",
        body: [
          "تبقى ملكية التقييمات والصور والرسائل التي تنشرها لك. وتمنح مشوار ترخيصًا غير حصري ومجانيًا لاستضافتها وعرضها وترجمتها على المنصة وللترويج للمنصة، ما دامت منشورة على مشوار، وبالقدر اللازم بعد ذلك لأغراض السجلات.",
          "يجب أن يلتزم المحتوى بإرشادات المجتمع. يجوز لنا إخفاء المحتوى المخالف أو حذفه، ونحتفظ بسجلّ لقرارات الإشراف. لا يمكن للأنشطة التجارية تعديل التقييمات أو إخفاؤها أو حذفها، لكن يمكنها الرد عليها أو الإبلاغ عنها.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "الاستخدام المقبول",
        body: [
          "لا تستخدم مشوار من أجل:",
          {
            list: [
              "مخالفة القانون اللبناني أو التعدّي على حقوق الآخرين؛",
              "إنشاء حسابات أو تجارب أو حجوزات أو تقييمات زائفة، أو ارتكاب الاحتيال؛",
              "نسخ التجارب أو البيانات أو جمعها آليًا بكميات كبيرة، أو التحايل على حدود الاستخدام؛",
              "فحص أمن مشوار أو اختباره دون إذن خطي منا (أبلغنا عن الثغرات بدلًا من ذلك)؛",
              "رفع برمجيات خبيثة أو ملفات لا يحقّ لك مشاركتها؛",
              "مضايقة الآخرين أو نشر بياناتهم الشخصية.",
            ],
          },
        ],
      },
      {
        id: "group-trips",
        heading: "الرحلات الجماعية وروابط المشاركة",
        body: [
          "يستطيع كل من يملك رابط مشاركة الرحلة أو رابط الدعوة إليها أن يطّلع عليها، وأن ينضمّ ويصوّت إذا سمحت بذلك. شارك الروابط مع من تثق بهم فقط، وألغِ الرابط إذا وصل إلى أشخاص غير مقصودين. كل من يحجز يدفع ثمن حجزه ويتحمّل مسؤوليته، ما لم يُذكر خلاف ذلك في الحجز.",
        ],
      },
      {
        id: "liability",
        heading: "المسؤولية",
        body: [
          "النشاط التجاري الذي ينظّم التجربة مسؤول عن تقديمها بأمان وكما هي موصوفة. ونحن مسؤولون عن تشغيل المنصة بعناية ومهارة معقولتين.",
          "في الحدود التي يسمح بها القانون اللبناني، لا نتحمّل المسؤولية عن الخسائر غير المباشرة، ولا عن الخسائر الناتجة عن أحداث خارجة عن سيطرتنا المعقولة، مثل انقطاع الشبكات أو الإضرابات أو الأحداث الأمنية في المنطقة أو الإغلاقات الرسمية.",
          "لا يحدّ أي بند في هذه الشروط من المسؤولية عن الاحتيال أو الخطأ المتعمّد أو الإهمال الجسيم، ولا يُسقط أي حق لك بموجب قانون حماية المستهلك اللبناني رقم 659/2005 أو غيره من القوانين التي لا يجوز استبعادها بالاتفاق.",
        ],
      },
      {
        id: "suspension",
        heading: "تعليق الحسابات أو إغلاقها",
        body: [
          "يمكنك حذف حسابك في أي وقت من الإعدادات. ويجوز لنا تقييد أي حساب أو تعليقه أو إغلاقه إذا خالف هذه الشروط أو عرّض الآخرين للخطر أو اقتضى ذلك التزام قانوني. وحيثما أمكن، سنبلغك بالسبب ونمنحك فرصة للرد. وتُعالَج الحجوزات المؤكَّدة بإنصاف، بما في ذلك ردّ المبالغ المستحقّة.",
        ],
      },
      {
        id: "changes",
        heading: "تعديل هذه الشروط",
        body: [
          "قد نحدّث هذه الشروط عند تغيّر الخدمة أو القانون. وفي حال التعديلات المهمة، سنبلغك داخل التطبيق ونطلب منك قبول الإصدار الجديد قبل متابعة استخدام حسابك. لا تؤثّر التعديلات في الحجوزات التي تمّت سابقًا.",
        ],
      },
      {
        id: "law",
        heading: "القانون الواجب التطبيق والنزاعات",
        body: [
          "تخضع هذه الشروط للقانون اللبناني. إذا واجهتك مشكلة فتواصل معنا أولًا عبر {contact}، فمعظم المشكلات يمكن حلّها بسرعة.",
          "بصفتك مستهلكًا، يمكنك أيضًا مراجعة مديرية حماية المستهلك في وزارة الاقتصاد والتجارة. وأي نزاع لا نتمكّن من تسويته معًا يُحال إلى المحاكم اللبنانية المختصة، دون المساس بأي مرجع آخر يمنحك إياه القانون.",
        ],
      },
    ],
  },
  fr: {
    title: "Conditions d’utilisation",
    summary:
      "Les règles d’utilisation de Mshwar pour planifier des voyages, réserver des expériences et gérer une fiche professionnelle, et ce que chacun peut attendre de l’autre.",
    sections: [
      {
        id: "about",
        heading: "À propos de ces conditions",
        body: [
          "Mshwar est exploité par {entity}, {address} (« Mshwar », « nous »). Ces conditions s’appliquent lorsque vous utilisez le site ou l’application Mshwar. En créant un compte, vous les acceptez, ainsi que notre politique de confidentialité, notre politique d’annulation et nos règles de la communauté.",
          "Chaque version est datée. Pour toute question sur ces conditions, contactez-nous via {contact}.",
        ],
      },
      {
        id: "accounts",
        heading: "Votre compte",
        body: [
          {
            list: [
              "Vous devez avoir 18 ans ou plus pour créer un compte.",
              "Fournissez des informations exactes et tenez-les à jour. Les réservations et les reçus utilisent le nom et l’adresse e-mail de votre compte.",
              "Gardez votre mot de passe secret. Vous êtes responsable de l’activité de votre compte, sauf s’il a été utilisé sans votre autorisation et que vous nous en informez rapidement.",
              "Un compte par personne. Le personnel d’une entreprise utilise son propre compte personnel, rattaché à l’entreprise avec un rôle.",
            ],
          },
        ],
      },
      {
        id: "our-role",
        heading: "Le rôle de Mshwar",
        body: [
          "Mshwar est une place de marché. Nous vous aidons à découvrir et à planifier des expériences au Liban, et nous permettons à des entreprises indépendantes de les proposer et de les vendre. L’entreprise qui organise une expérience en est le prestataire, et votre réservation crée un accord entre vous et cette entreprise.",
          "Nous exploitons la plateforme, affichons le prix et les conditions de chaque offre avant votre engagement, traitons les paiements via notre prestataire de paiement et vous aidons en cas de problème. Nous vérifions les entreprises avant qu’elles puissent recevoir des réservations, mais nous n’organisons pas les expériences nous-mêmes.",
        ],
      },
      {
        id: "planner",
        heading: "Plans et suggestions de l’IA",
        body: [
          "Le planificateur utilise des outils automatisés pour proposer des itinéraires. Un plan est une suggestion, pas une réservation ni une garantie qu’un lieu est ouvert, disponible ou adapté à vous. Vérifiez les horaires, les conditions de déplacement, les consignes de sécurité officielles et les conditions de chaque offre avant de vous y fier.",
          "Ne saisissez pas de données personnelles sensibles concernant d’autres personnes dans le planificateur.",
        ],
      },
      {
        id: "booking",
        heading: "Réserver une expérience",
        body: [
          "Chaque offre indique son mode de réservation :",
          {
            list: [
              "Réservation instantanée : votre place est bloquée pendant 15 minutes le temps du paiement. Si un paiement est requis, la réservation n’est confirmée qu’après sa réussite. Si le délai expire, rien n’est débité.",
              "Demande de réservation : l’entreprise doit l’accepter. Elle dispose de 24 heures pour répondre, ou jusqu’au début de l’expérience si celui-ci est plus proche. Sans réponse dans ce délai, la demande devient caduque et rien n’est débité.",
              "Demande d’information : un message à l’entreprise. Elle ne réserve aucune place et ne vous engage à rien.",
            ],
          },
          "Vérifiez la date, l’heure, le nombre de participants, le point de rendez-vous, ce qui est inclus et les éventuelles conditions (âge, condition physique) avant de confirmer. Signalez à l’entreprise tout ce qu’elle doit savoir pour organiser l’expérience en sécurité.",
        ],
      },
      {
        id: "prices",
        heading: "Prix et paiement",
        body: [
          "Le prix total, la devise et ce que comprend le prix sont affichés avant le paiement. Lorsque la loi libanaise exige un prix en livres libanaises, il est également affiché. Aucun frais supplémentaire non affiché au paiement ne peut être facturé via Mshwar.",
          "Les paiements sont traités par notre prestataire de paiement. Nous ne recevons jamais votre numéro de carte complet. Les remboursements sont versés sur le moyen de paiement d’origine.",
        ],
      },
      {
        id: "cancellations",
        heading: "Annulations et remboursements",
        body: [
          "Les conditions d’annulation affichées au moment de la réservation sont enregistrées avec celle-ci ; les modifications ultérieures de l’offre ne vous concernent pas. Si l’entreprise annule, vous êtes remboursé intégralement. Les détails figurent dans notre politique d’annulation.",
        ],
      },
      {
        id: "businesses",
        heading: "Les entreprises sur Mshwar",
        body: [
          "Si vous proposez des expériences sur Mshwar, vous vous engagez également à :",
          {
            list: [
              "terminer la vérification et tenir à jour les informations, licences et assurances de votre organisation, comme l’exigent la loi libanaise et votre activité ;",
              "décrire exactement chaque expérience, son prix, son point de rendez-vous et ses conditions d’annulation, et n’utiliser que des photos que vous avez le droit d’utiliser ;",
              "honorer les réservations confirmées, répondre à temps aux demandes et indiquer un motif si vous devez annuler ;",
              "n’utiliser les données personnelles des clients que pour exécuter leur réservation et respecter vos obligations légales, et les protéger ;",
              "ne donner au personnel que les rôles nécessaires et retirer l’accès des personnes qui partent ;",
              "ne pas contacter les clients pour déplacer une réservation ou un paiement hors de Mshwar.",
            ],
          },
          "Les frais et les conditions de versement des entreprises sont convenus séparément dans le portail professionnel.",
        ],
      },
      {
        id: "content",
        heading: "Avis et autres contenus",
        body: [
          "Vous restez propriétaire des avis, photos et messages que vous publiez. Vous accordez à Mshwar une licence non exclusive et gratuite pour les héberger, les afficher et les traduire sur la plateforme et pour promouvoir la plateforme, tant qu’ils restent sur Mshwar et, ensuite, dans la mesure nécessaire à la tenue des registres.",
          "Les contenus doivent respecter nos règles de la communauté. Nous pouvons masquer ou retirer ceux qui les enfreignent, et nous conservons une trace des décisions de modération. Les entreprises ne peuvent ni modifier, ni masquer, ni supprimer un avis ; elles peuvent y répondre ou le signaler.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "Utilisation acceptable",
        body: [
          "N’utilisez pas Mshwar pour :",
          {
            list: [
              "enfreindre la loi libanaise ou les droits d’autrui ;",
              "créer de faux comptes, offres, réservations ou avis, ou commettre une fraude ;",
              "copier ou extraire en masse des offres ou des données, ou contourner les limites d’utilisation ;",
              "sonder, analyser ou tester la sécurité de Mshwar sans notre autorisation écrite (signalez-nous plutôt les vulnérabilités) ;",
              "téléverser des logiciels malveillants ou des fichiers que vous n’avez pas le droit de partager ;",
              "harceler d’autres personnes ou divulguer leurs données personnelles.",
            ],
          },
        ],
      },
      {
        id: "group-trips",
        heading: "Voyages de groupe et liens de partage",
        body: [
          "Toute personne disposant du lien de partage ou d’invitation d’un voyage peut le consulter et, si vous l’autorisez, le rejoindre et voter. Ne partagez ces liens qu’avec des personnes de confiance et révoquez un lien s’il parvient aux mauvaises personnes. Chaque personne qui réserve paie sa propre réservation et en est responsable, sauf indication contraire dans la réservation.",
        ],
      },
      {
        id: "liability",
        heading: "Responsabilité",
        body: [
          "L’entreprise qui organise une expérience est responsable de la fournir en toute sécurité et conformément à sa description. Nous sommes responsables d’exploiter la plateforme avec un soin et une compétence raisonnables.",
          "Dans la mesure permise par la loi libanaise, nous ne sommes pas responsables des pertes indirectes, ni des pertes causées par des événements échappant à notre contrôle raisonnable, tels que des pannes de réseau, des grèves, des incidents de sécurité dans la région ou des fermetures officielles.",
          "Rien dans ces conditions ne limite la responsabilité en cas de fraude, de faute intentionnelle ou de négligence grave, ni ne supprime les droits que vous tirez de la loi libanaise n° 659/2005 sur la protection du consommateur ou d’autres lois auxquelles on ne peut déroger par contrat.",
        ],
      },
      {
        id: "suspension",
        heading: "Suspension ou fermeture d’un compte",
        body: [
          "Vous pouvez supprimer votre compte à tout moment depuis les Paramètres. Nous pouvons restreindre, suspendre ou fermer un compte qui enfreint ces conditions, met autrui en danger, ou lorsque la loi l’exige. Lorsque c’est possible, nous vous en indiquerons la raison et vous permettrons de répondre. Les réservations déjà confirmées seront traitées équitablement, y compris les remboursements dus.",
        ],
      },
      {
        id: "changes",
        heading: "Modifications de ces conditions",
        body: [
          "Nous pouvons mettre à jour ces conditions lorsque le service ou la loi évolue. En cas de changement important, nous vous en informerons dans l’application et vous demanderons d’accepter la nouvelle version avant de continuer à utiliser votre compte. Les modifications n’affectent pas les réservations déjà effectuées.",
        ],
      },
      {
        id: "law",
        heading: "Droit applicable et litiges",
        body: [
          "Ces conditions sont régies par le droit libanais. En cas de problème, contactez-nous d’abord via {contact} ; la plupart des situations se règlent rapidement.",
          "En tant que consommateur, vous pouvez aussi vous adresser à la Direction de la protection du consommateur du ministère de l’Économie et du Commerce. Tout litige que nous ne pouvons pas régler ensemble relève des tribunaux libanais compétents, sans préjudice de toute autre juridiction que la loi vous ouvre.",
        ],
      },
    ],
  },
};
