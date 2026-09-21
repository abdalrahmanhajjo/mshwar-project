import type { LegalLibrary } from "./types";

export const PRIVACY_POLICY: LegalLibrary = {
  en: {
    title: "Privacy policy",
    summary:
      "What we collect when you plan, book or list experiences on Mshwar, why we use it, who we share it with, and the controls you have.",
    sections: [
      {
        id: "who-we-are",
        heading: "Who we are",
        body: [
          "Mshwar is operated by {entity}, {address} (“Mshwar”, “we”). We decide how the personal data described here is used and we are responsible for it.",
          "This policy follows Lebanese Law No. 81 of 10 October 2018 on Electronic Transactions and Personal Data. You can reach us about privacy through {contact}.",
        ],
      },
      {
        id: "what-we-collect",
        heading: "What we collect",
        body: [
          {
            list: [
              "Account details: your name, email address, preferred language and a one-way hash of your password. We never store your password itself.",
              "Travel preferences you save, such as interests, pace, budget and group size.",
              "Trip plans, including the requests you type into the AI planner and the itineraries it produces.",
              "Bookings: the experience, date, party size, price, cancellation terms and messages to the business.",
              "Payments: the amount, currency, status and the payment provider's reference. Card details go directly to the payment provider; we never receive or store full card numbers.",
              "Reviews, reports and group-trip suggestions or votes you submit.",
              "For business accounts: the organisation's details, staff roles and the verification documents you upload.",
              "Location, only when you choose to share it or pin a starting point for a plan.",
              "Technical data needed to run and protect the service: IP address, browser type, request identifiers and security logs.",
            ],
          },
        ],
      },
      {
        id: "how-we-use",
        heading: "How and why we use it",
        body: [
          {
            list: [
              "To run your account, build plans, take bookings and process payments and refunds. We need this data to provide the service you asked for.",
              "To keep Mshwar safe: preventing fraud and abuse, enforcing rate limits, investigating incidents and keeping an audit trail of important actions.",
              "To meet legal duties, such as keeping accounting records and answering lawful requests from Lebanese authorities.",
              "To personalise plans and suggestions with your saved preferences and activity. We do this only if you switch personalisation on, and you can switch it off at any time.",
              "To send you travel ideas and offers. We do this only if you agree to marketing messages. Booking confirmations and other service messages are sent regardless, because they are part of the service.",
            ],
          },
        ],
      },
      {
        id: "ai-planner",
        heading: "The AI trip planner",
        body: [
          "When you ask the planner for a trip, your request and the constraints we extract from it are processed to build an itinerary. The text you type is not shared with businesses.",
          "Feedback on plans is used to improve suggestions only while personalisation is on. Plans are suggestions: always check opening hours, travel conditions and the business's own terms before you go.",
        ],
      },
      {
        id: "sharing",
        heading: "Who we share it with",
        body: [
          {
            list: [
              "The business you book with: your name, party size, booking details and any note you add, so it can deliver the experience.",
              "Service providers who work for us under contract: hosting and databases, email delivery, the payment provider, error monitoring (with personal details removed first), image delivery (ImageKit) and maps (Google Maps, only when you choose to load a map).",
              "Authorities, when Lebanese law requires it or when it is needed to protect people's safety.",
              "A buyer or successor, if Mshwar's business is transferred, under the same protections.",
            ],
          },
          "We do not sell your personal data.",
        ],
      },
      {
        id: "transfers",
        heading: "Processing outside Lebanon",
        body: [
          "Some of our providers store or process data outside Lebanon. We choose providers that protect personal data to a standard at least as high as this policy, and we limit what each one receives to what it needs.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it",
        body: [
          {
            list: [
              "Account and preference data: while your account is open. When you delete your account, your profile is anonymised.",
              "Bookings, payments and refunds: kept for as long as Lebanese commercial and tax law requires, even after account deletion. They are then linked only to an anonymised account.",
              "Reviews: kept after deletion, shown under an anonymised name.",
              "Security and audit records: kept for as long as they are needed to protect the service and to account for important actions. They cannot be edited.",
              "Verification documents: kept while the business account is active and for as long as needed to show how it was verified.",
            ],
          },
        ],
      },
      {
        id: "your-rights",
        heading: "Your rights and controls",
        body: [
          "Under Law No. 81/2018 you can ask to access and correct your personal data, and you can object to its processing for legitimate reasons, including for marketing. You can also:",
          {
            list: [
              "download a copy of your data from Settings → Your data;",
              "reset personalisation, which clears saved preferences and recommendation signals;",
              "switch personalisation and marketing consent on or off, each on its own;",
              "delete your account, which anonymises your profile.",
            ],
          },
          "For anything else, contact us through {contact}. We may need to confirm your identity first. If you are not satisfied with our answer, you can complain to the competent Lebanese authority, the Ministry of Economy and Trade.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies and similar technologies",
        body: [
          "Essential cookies are always on because the site cannot work without them:",
          {
            list: [
              "mshwar_session: keeps you signed in (7 days);",
              "mshwar_guest: lets a guest take part in a shared group trip (30 days);",
              "mshwar-locale: remembers your language (1 year);",
              "mshwar-consent: remembers your cookie choices (1 year).",
            ],
          },
          "Optional categories stay off until you allow them in Cookie settings:",
          {
            list: [
              "Error reporting: sends details of errors in your browser to our monitoring service, with personal details removed.",
              "Maps and embedded content: loads Google Maps, which may set its own cookies.",
            ],
          },
          "You can change your choices at any time from the Cookie settings link at the bottom of every page.",
        ],
      },
      {
        id: "security",
        heading: "How we protect it",
        body: [
          "We use encrypted connections, strong password hashing, role-based access, database-level isolation between businesses, short-lived signed links for private documents, and an append-only audit log. No system is perfectly secure; if a breach affects you, we will tell you and explain what we are doing about it.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        body: [
          "Mshwar accounts are for people aged 18 or over. Children can join experiences booked by an adult who is responsible for them.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        body: [
          "Each version has a date. If we make an important change, we will tell you in the app and ask you to review it before you continue using your account.",
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    summary:
      "ما الذي نجمعه عندما تخطّط لرحلة أو تحجز تجربة أو تعرض تجاربك على مشوار، ولماذا نستخدمه، ومع من نشاركه، والخيارات المتاحة لك.",
    sections: [
      {
        id: "who-we-are",
        heading: "من نحن",
        body: [
          "تُشغّل منصةَ مشوار الجهةُ {entity}، {address} (ويُشار إليها بـ«مشوار» أو «نحن»). نحن من يقرّر كيفية استخدام البيانات الشخصية الموصوفة هنا، ونتحمّل المسؤولية عنها.",
          "تستند هذه السياسة إلى القانون اللبناني رقم 81 الصادر في 10 تشرين الأول 2018 المتعلق بالمعاملات الإلكترونية والبيانات ذات الطابع الشخصي. يمكنك التواصل معنا بشأن الخصوصية عبر {contact}.",
        ],
      },
      {
        id: "what-we-collect",
        heading: "البيانات التي نجمعها",
        body: [
          {
            list: [
              "بيانات الحساب: اسمك وعنوان بريدك الإلكتروني ولغتك المفضّلة وقيمة مشفّرة باتجاه واحد لكلمة مرورك. لا نخزّن كلمة المرور نفسها أبدًا.",
              "تفضيلات السفر التي تحفظها، مثل الاهتمامات ووتيرة الرحلة والميزانية وحجم المجموعة.",
              "خطط الرحلات، بما فيها الطلبات التي تكتبها في المخطِّط الذكي والبرامج التي يقترحها.",
              "الحجوزات: التجربة والتاريخ وعدد الأشخاص والسعر وشروط الإلغاء والرسائل الموجّهة إلى المنشأة.",
              "المدفوعات: المبلغ والعملة والحالة ومرجع مزوّد خدمة الدفع. تُرسَل بيانات البطاقة مباشرة إلى مزوّد الدفع، ولا نتلقّى أرقام البطاقات كاملةً ولا نخزّنها.",
              "المراجعات والبلاغات والاقتراحات أو الأصوات التي ترسلها في الرحلات الجماعية.",
              "لحسابات المنشآت: بيانات المنشأة وأدوار الموظفين ووثائق التحقق التي تُرفَع.",
              "الموقع الجغرافي، فقط عندما تختار مشاركته أو تحديد نقطة انطلاق لخطتك.",
              "البيانات التقنية اللازمة لتشغيل الخدمة وحمايتها: عنوان IP ونوع المتصفح ومعرّفات الطلبات وسجلات الأمان.",
            ],
          },
        ],
      },
      {
        id: "how-we-use",
        heading: "كيف نستخدم البيانات ولماذا",
        body: [
          {
            list: [
              "لتشغيل حسابك وإعداد الخطط وتسجيل الحجوزات ومعالجة المدفوعات والمبالغ المستردّة، إذ نحتاج إلى هذه البيانات لتقديم الخدمة التي طلبتها.",
              "للحفاظ على أمان مشوار: منع الاحتيال وإساءة الاستخدام، وتطبيق حدود الطلبات، والتحقيق في الحوادث، والاحتفاظ بسجلّ تدقيق للإجراءات المهمة.",
              "للوفاء بالالتزامات القانونية، مثل الاحتفاظ بالسجلات المحاسبية والاستجابة للطلبات القانونية الصادرة عن السلطات اللبنانية.",
              "لتخصيص الخطط والاقتراحات بناءً على تفضيلاتك المحفوظة ونشاطك، وذلك فقط إذا فعّلت خيار التخصيص، ويمكنك إيقافه في أي وقت.",
              "لإرسال أفكار السفر والعروض إليك، فقط إذا وافقت على الرسائل التسويقية. أما تأكيدات الحجز ورسائل الخدمة الأخرى فتُرسَل في جميع الأحوال لأنها جزء من الخدمة.",
            ],
          },
        ],
      },
      {
        id: "ai-planner",
        heading: "مخطِّط الرحلات بالذكاء الاصطناعي",
        body: [
          "عندما تطلب من المخطِّط إعداد رحلة، نعالج طلبك والقيود المستخلصة منه لبناء البرنامج. لا نشارك النص الذي تكتبه مع المنشآت.",
          "لا نستخدم ملاحظاتك على الخطط لتحسين الاقتراحات إلا ما دام خيار التخصيص مفعّلًا. الخطط اقتراحات فقط، لذا تحقّق دائمًا من مواعيد العمل وظروف التنقّل وشروط المنشأة قبل الانطلاق.",
        ],
      },
      {
        id: "sharing",
        heading: "مع من نشارك البيانات",
        body: [
          {
            list: [
              "المنشأة التي تحجز لديها: اسمك وعدد الأشخاص وتفاصيل الحجز وأي ملاحظة تضيفها، كي تتمكّن من تقديم التجربة.",
              "مزوّدو الخدمات الذين يعملون لصالحنا بموجب عقود: الاستضافة وقواعد البيانات، وإرسال البريد الإلكتروني، ومزوّد الدفع، ومراقبة الأخطاء (بعد حذف البيانات الشخصية)، وتقديم الصور (ImageKit)، والخرائط (خرائط Google، فقط عندما تختار عرض خريطة).",
              "السلطات المختصّة، عندما يفرض القانون اللبناني ذلك أو عندما يكون ذلك ضروريًا لحماية سلامة الأشخاص.",
              "أي مشترٍ أو خلف قانوني في حال انتقال نشاط مشوار، مع الحفاظ على الضمانات نفسها.",
            ],
          },
          "لا نبيع بياناتك الشخصية.",
        ],
      },
      {
        id: "transfers",
        heading: "المعالجة خارج لبنان",
        body: [
          "يخزّن بعض مزوّدينا البيانات أو يعالجونها خارج لبنان. نختار مزوّدين يحمون البيانات الشخصية بمستوى لا يقلّ عن مستوى هذه السياسة، ونقصر ما يتلقّاه كلٌّ منهم على ما يحتاج إليه.",
        ],
      },
      {
        id: "retention",
        heading: "مدة الاحتفاظ بالبيانات",
        body: [
          {
            list: [
              "بيانات الحساب والتفضيلات: طوال فترة بقاء حسابك مفتوحًا. عند حذف الحساب، يُجعل ملفك الشخصي مجهول الهوية.",
              "الحجوزات والمدفوعات والمبالغ المستردّة: نحتفظ بها طوال المدة التي يفرضها قانونا التجارة والضرائب في لبنان، حتى بعد حذف الحساب، وتبقى مرتبطة بحساب مجهول الهوية فقط.",
              "المراجعات: تبقى بعد حذف الحساب وتظهر باسم مجهول.",
              "سجلات الأمان والتدقيق: نحتفظ بها طوال المدة اللازمة لحماية الخدمة وتوثيق الإجراءات المهمة، ولا يمكن تعديلها.",
              "وثائق التحقق: نحتفظ بها ما دام حساب المنشأة نشطًا، وطوال المدة اللازمة لإثبات كيفية التحقق منها.",
            ],
          },
        ],
      },
      {
        id: "your-rights",
        heading: "حقوقك وخياراتك",
        body: [
          "بموجب القانون رقم 81/2018، يحق لك طلب الاطلاع على بياناتك الشخصية وتصحيحها، والاعتراض على معالجتها لأسباب مشروعة، بما في ذلك لأغراض التسويق. ويمكنك أيضًا:",
          {
            list: [
              "تنزيل نسخة من بياناتك من الإعدادات ← بياناتك؛",
              "إعادة ضبط التخصيص، ما يؤدي إلى حذف التفضيلات المحفوظة وإشارات التوصية؛",
              "تفعيل الموافقة على التخصيص والموافقة على التسويق أو إيقاف كلٍّ منهما على حدة؛",
              "حذف حسابك، ما يجعل ملفك الشخصي مجهول الهوية.",
            ],
          },
          "لأي طلب آخر، تواصل معنا عبر {contact}. قد نحتاج أولًا إلى التحقق من هويتك. وإذا لم يرضِك ردّنا، يمكنك تقديم شكوى إلى الجهة اللبنانية المختصّة، وهي وزارة الاقتصاد والتجارة.",
        ],
      },
      {
        id: "cookies",
        heading: "ملفات تعريف الارتباط والتقنيات المشابهة",
        body: [
          "ملفات تعريف الارتباط الأساسية مفعّلة دائمًا لأن الموقع لا يعمل من دونها:",
          {
            list: [
              "mshwar_session: يُبقيك مسجّل الدخول (7 أيام)؛",
              "mshwar_guest: يتيح للضيف المشاركة في رحلة جماعية مشتركة (30 يومًا)؛",
              "mshwar-locale: يتذكّر لغتك (سنة واحدة)؛",
              "mshwar-consent: يتذكّر اختياراتك بشأن ملفات تعريف الارتباط (سنة واحدة).",
            ],
          },
          "تبقى الفئات الاختيارية معطّلة إلى أن تسمح بها من إعدادات ملفات تعريف الارتباط:",
          {
            list: [
              "الإبلاغ عن الأخطاء: يرسل تفاصيل الأخطاء التي تحدث في متصفحك إلى خدمة المراقبة لدينا بعد حذف البيانات الشخصية.",
              "الخرائط والمحتوى المضمَّن: يحمّل خرائط Google، التي قد تضع ملفات تعريف الارتباط الخاصة بها.",
            ],
          },
          "يمكنك تغيير اختياراتك في أي وقت عبر رابط «إعدادات ملفات تعريف الارتباط» أسفل كل صفحة.",
        ],
      },
      {
        id: "security",
        heading: "كيف نحمي بياناتك",
        body: [
          "نستخدم اتصالات مشفّرة، وتشفيرًا قويًا لكلمات المرور، وصلاحيات مبنية على الأدوار، وعزلًا بين المنشآت على مستوى قاعدة البيانات، وروابط موقّعة قصيرة الأجل للوثائق الخاصة، وسجلّ تدقيق لا يقبل التعديل. لا يوجد نظام آمن تمامًا، وإذا تعرّضت بياناتك لاختراق فسنبلغك بذلك ونوضح الإجراءات التي نتخذها.",
        ],
      },
      {
        id: "children",
        heading: "الأطفال",
        body: [
          "حسابات مشوار مخصّصة لمن بلغوا 18 عامًا فما فوق. يمكن للأطفال المشاركة في التجارب التي يحجزها شخص بالغ مسؤول عنهم.",
        ],
      },
      {
        id: "changes",
        heading: "التعديلات على هذه السياسة",
        body: [
          "لكل إصدار تاريخ محدّد. إذا أجرينا تعديلًا مهمًا، فسنبلغك داخل التطبيق ونطلب منك مراجعته قبل متابعة استخدام حسابك.",
        ],
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    summary:
      "Ce que nous collectons lorsque vous planifiez, réservez ou proposez des expériences sur Mshwar, pourquoi nous l’utilisons, avec qui nous le partageons et les moyens de contrôle dont vous disposez.",
    sections: [
      {
        id: "who-we-are",
        heading: "Qui sommes-nous",
        body: [
          "Mshwar est exploité par {entity}, {address} (« Mshwar », « nous »). Nous décidons de l’utilisation des données personnelles décrites ici et en sommes responsables.",
          "Cette politique s’appuie sur la loi libanaise n° 81 du 10 octobre 2018 relative aux transactions électroniques et aux données à caractère personnel. Pour toute question de confidentialité, contactez-nous via {contact}.",
        ],
      },
      {
        id: "what-we-collect",
        heading: "Ce que nous collectons",
        body: [
          {
            list: [
              "Données de compte : votre nom, votre adresse e-mail, votre langue préférée et une empreinte irréversible de votre mot de passe. Nous ne conservons jamais le mot de passe lui-même.",
              "Les préférences de voyage que vous enregistrez : centres d’intérêt, rythme, budget, taille du groupe.",
              "Vos projets de voyage, y compris les demandes saisies dans le planificateur IA et les itinéraires qu’il propose.",
              "Réservations : l’expérience, la date, le nombre de participants, le prix, les conditions d’annulation et les messages adressés à l’établissement.",
              "Paiements : le montant, la devise, le statut et la référence du prestataire de paiement. Les données de carte sont transmises directement à ce prestataire ; nous ne recevons ni ne conservons jamais les numéros de carte complets.",
              "Les avis, signalements, suggestions et votes que vous soumettez dans les voyages de groupe.",
              "Pour les comptes professionnels : les informations sur l’établissement, les rôles du personnel et les justificatifs de vérification téléversés.",
              "Votre localisation, uniquement si vous choisissez de la partager ou de fixer un point de départ pour un itinéraire.",
              "Les données techniques nécessaires au fonctionnement et à la protection du service : adresse IP, type de navigateur, identifiants de requête et journaux de sécurité.",
            ],
          },
        ],
      },
      {
        id: "how-we-use",
        heading: "Comment et pourquoi nous les utilisons",
        body: [
          {
            list: [
              "Pour gérer votre compte, établir vos itinéraires, enregistrer vos réservations et traiter paiements et remboursements. Ces données sont indispensables au service que vous demandez.",
              "Pour protéger Mshwar : prévenir la fraude et les abus, appliquer des limites d’usage, enquêter sur les incidents et tenir un journal d’audit des actions importantes.",
              "Pour respecter nos obligations légales, comme la tenue des registres comptables ou la réponse aux demandes légitimes des autorités libanaises.",
              "Pour personnaliser itinéraires et suggestions à partir de vos préférences et de votre activité, uniquement si vous activez la personnalisation. Vous pouvez la désactiver à tout moment.",
              "Pour vous envoyer des idées de voyage et des offres, uniquement si vous acceptez les communications marketing. Les confirmations de réservation et autres messages de service sont envoyés dans tous les cas, car ils font partie du service.",
            ],
          },
        ],
      },
      {
        id: "ai-planner",
        heading: "Le planificateur de voyage IA",
        body: [
          "Lorsque vous demandez un itinéraire, votre demande et les contraintes qui en sont extraites sont traitées pour le construire. Le texte que vous saisissez n’est pas communiqué aux établissements.",
          "Vos retours sur les itinéraires ne servent à améliorer les suggestions que tant que la personnalisation est activée. Les itinéraires sont des suggestions : vérifiez toujours les horaires, les conditions de déplacement et les conditions propres à l’établissement avant de partir.",
        ],
      },
      {
        id: "sharing",
        heading: "Avec qui nous les partageons",
        body: [
          {
            list: [
              "L’établissement auprès duquel vous réservez : votre nom, le nombre de participants, les détails de la réservation et votre éventuelle note, afin qu’il puisse assurer l’expérience.",
              "Nos sous-traitants liés par contrat : hébergement et bases de données, envoi d’e-mails, prestataire de paiement, suivi des erreurs (après suppression des données personnelles), diffusion des images (ImageKit) et cartes (Google Maps, uniquement si vous choisissez d’afficher une carte).",
              "Les autorités, lorsque la loi libanaise l’exige ou que la sécurité des personnes le requiert.",
              "Un acquéreur ou successeur en cas de transfert de l’activité de Mshwar, avec les mêmes garanties.",
            ],
          },
          "Nous ne vendons pas vos données personnelles.",
        ],
      },
      {
        id: "transfers",
        heading: "Traitement hors du Liban",
        body: [
          "Certains de nos prestataires stockent ou traitent des données hors du Liban. Nous choisissons des prestataires qui protègent les données personnelles au moins aussi bien que le prévoit cette politique, et nous limitons ce que chacun reçoit au strict nécessaire.",
        ],
      },
      {
        id: "retention",
        heading: "Durée de conservation",
        body: [
          {
            list: [
              "Données de compte et préférences : tant que votre compte est ouvert. Lorsque vous le supprimez, votre profil est anonymisé.",
              "Réservations, paiements et remboursements : conservés aussi longtemps que l’exigent le droit commercial et le droit fiscal libanais, même après la suppression du compte. Ils ne sont alors plus liés qu’à un compte anonymisé.",
              "Avis : conservés après la suppression du compte et affichés sous un nom anonymisé.",
              "Journaux de sécurité et d’audit : conservés aussi longtemps que nécessaire pour protéger le service et justifier les actions importantes. Ils ne peuvent pas être modifiés.",
              "Justificatifs de vérification : conservés tant que le compte professionnel est actif et aussi longtemps que nécessaire pour démontrer la vérification.",
            ],
          },
        ],
      },
      {
        id: "your-rights",
        heading: "Vos droits et vos réglages",
        body: [
          "En vertu de la loi n° 81/2018, vous pouvez demander à accéder à vos données personnelles et à les rectifier, et vous opposer à leur traitement pour des motifs légitimes, notamment à des fins de prospection. Vous pouvez aussi :",
          {
            list: [
              "télécharger une copie de vos données depuis Paramètres → Vos données ;",
              "réinitialiser la personnalisation, ce qui efface vos préférences enregistrées et vos signaux de recommandation ;",
              "activer ou désactiver séparément le consentement à la personnalisation et le consentement marketing ;",
              "supprimer votre compte, ce qui anonymise votre profil.",
            ],
          },
          "Pour toute autre demande, contactez-nous via {contact}. Nous pourrons d’abord vous demander de confirmer votre identité. Si notre réponse ne vous satisfait pas, vous pouvez saisir l’autorité libanaise compétente, le ministère de l’Économie et du Commerce.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies et technologies similaires",
        body: [
          "Les cookies essentiels sont toujours actifs, car le site ne peut pas fonctionner sans eux :",
          {
            list: [
              "mshwar_session : vous garde connecté (7 jours) ;",
              "mshwar_guest : permet à un invité de participer à un voyage de groupe partagé (30 jours) ;",
              "mshwar-locale : mémorise votre langue (1 an) ;",
              "mshwar-consent : mémorise vos choix en matière de cookies (1 an).",
            ],
          },
          "Les catégories facultatives restent désactivées tant que vous ne les autorisez pas dans les réglages des cookies :",
          {
            list: [
              "Signalement des erreurs : envoie à notre service de suivi les détails des erreurs survenues dans votre navigateur, après suppression des données personnelles.",
              "Cartes et contenus intégrés : charge Google Maps, qui peut déposer ses propres cookies.",
            ],
          },
          "Vous pouvez modifier vos choix à tout moment grâce au lien « Réglages des cookies » en bas de chaque page.",
        ],
      },
      {
        id: "security",
        heading: "Comment nous les protégeons",
        body: [
          "Nous utilisons des connexions chiffrées, un hachage robuste des mots de passe, des accès fondés sur les rôles, une isolation entre établissements au niveau de la base de données, des liens signés à durée limitée pour les documents privés et un journal d’audit non modifiable. Aucun système n’est parfaitement sûr ; si une violation vous concerne, nous vous en informerons et vous expliquerons les mesures prises.",
        ],
      },
      {
        id: "children",
        heading: "Enfants",
        body: [
          "Les comptes Mshwar sont réservés aux personnes âgées de 18 ans ou plus. Les enfants peuvent participer à des expériences réservées par un adulte qui en est responsable.",
        ],
      },
      {
        id: "changes",
        heading: "Modifications de cette politique",
        body: [
          "Chaque version est datée. En cas de modification importante, nous vous en informerons dans l’application et vous demanderons d’en prendre connaissance avant de continuer à utiliser votre compte.",
        ],
      },
    ],
  },
};
