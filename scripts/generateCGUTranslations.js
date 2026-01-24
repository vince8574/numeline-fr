const fs = require('fs');
const path = require('path');

// Version française simplifiée pour mobile (base)
const cguFR = `# Conditions Générales d'Utilisation - Eats OK

*Dernière mise à jour : 13 décembre 2025*

**IMPORTANT** : En téléchargeant, installant ou utilisant l'application Eats OK, vous acceptez sans réserve les présentes Conditions Générales d'Utilisation.

Cette application et ses fonctionnalités sont protégées par le droit d'auteur et l'antériorité.
This application and its functionalities are protected by copyright and prior art.

---

## 1. Service

Eats OK est une application mobile gratuite permettant de scanner des produits alimentaires et vérifier s'ils font l'objet d'un rappel.

## 2. Fonctionnement

- Scanner via l'appareil photo
- Reconnaissance automatique (marque et lot)
- Vérification des rappels
- Notifications en cas de rappel
- Historique local

## 3. Précision OCR

La reconnaissance de texte peut comporter des erreurs. Vous devez toujours vérifier visuellement les informations détectées.

## 4. Responsabilité

L'éditeur ne garantit pas la précision des informations. En cas de rappel, consultez les sources officielles.

## 5. Données

Toutes vos données sont stockées localement sur votre appareil. Aucune photo n'est envoyée sur un serveur.

## 6. Contact

Email : legal@eatsok.app
`;

// Traductions
const translations = {
  en: {
    title: "Terms of Service - Eats OK",
    updated: "Last updated: December 13, 2025",
    important: "**IMPORTANT**: By downloading, installing or using the Eats OK application, you unconditionally accept these Terms of Service.",
    protection: "This application and its functionalities are protected by copyright and prior art.",
    service: "Service",
    serviceDesc: "Eats OK is a free mobile application that allows you to scan food products and check if they are subject to a recall.",
    features: "Features",
    featuresList: `- Scan via camera
- Automatic recognition (brand and lot)
- Recall verification
- Recall notifications
- Local history`,
    ocr: "OCR Accuracy",
    ocrDesc: "Text recognition may contain errors. You must always visually verify the detected information.",
    liability: "Liability",
    liabilityDesc: "The publisher does not guarantee the accuracy of information. In case of recall, consult official sources.",
    data: "Data",
    dataDesc: "All your data is stored locally on your device. No photo is sent to a server.",
    contact: "Contact"
  },
  es: {
    title: "Condiciones de Uso - Eats OK",
    updated: "Última actualización: 13 de diciembre de 2025",
    important: "**IMPORTANTE**: Al descargar, instalar o utilizar la aplicación Eats OK, acepta incondicionalmente estas Condiciones de Uso.",
    protection: "Esta aplicación y sus funcionalidades están protegidas por derechos de autor y anterioridad.",
    service: "Servicio",
    serviceDesc: "Eats OK es una aplicación móvil gratuita que le permite escanear productos alimenticios y verificar si están sujetos a una retirada.",
    features: "Funcionalidades",
    featuresList: `- Escanear con la cámara
- Reconocimiento automático (marca y lote)
- Verificación de retiradas
- Notificaciones de retirada
- Historial local`,
    ocr: "Precisión OCR",
    ocrDesc: "El reconocimiento de texto puede contener errores. Siempre debe verificar visualmente la información detectada.",
    liability: "Responsabilidad",
    liabilityDesc: "El editor no garantiza la exactitud de la información. En caso de retirada, consulte las fuentes oficiales.",
    data: "Datos",
    dataDesc: "Todos sus datos se almacenan localmente en su dispositivo. Ninguna foto se envía a un servidor.",
    contact: "Contacto"
  },
  de: {
    title: "Nutzungsbedingungen - Eats OK",
    updated: "Letzte Aktualisierung: 13. Dezember 2025",
    important: "**WICHTIG**: Durch Herunterladen, Installieren oder Verwenden der Eats OK-Anwendung akzeptieren Sie bedingungslos diese Nutzungsbedingungen.",
    protection: "Diese Anwendung und ihre Funktionalitäten sind durch Urheberrecht und Priorität geschützt.",
    service: "Dienst",
    serviceDesc: "Eats OK ist eine kostenlose mobile Anwendung, mit der Sie Lebensmittelprodukte scannen und überprüfen können, ob sie einem Rückruf unterliegen.",
    features: "Funktionen",
    featuresList: `- Scannen mit der Kamera
- Automatische Erkennung (Marke und Charge)
- Rückrufüberprüfung
- Rückrufbenachrichtigungen
- Lokaler Verlauf`,
    ocr: "OCR-Genauigkeit",
    ocrDesc: "Die Texterkennung kann Fehler enthalten. Sie müssen die erkannten Informationen immer visuell überprüfen.",
    liability: "Haftung",
    liabilityDesc: "Der Herausgeber garantiert nicht die Richtigkeit der Informationen. Im Falle eines Rückrufs konsultieren Sie offizielle Quellen.",
    data: "Daten",
    dataDesc: "Alle Ihre Daten werden lokal auf Ihrem Gerät gespeichert. Kein Foto wird an einen Server gesendet.",
    contact: "Kontakt"
  },
  it: {
    title: "Condizioni d'Uso - Eats OK",
    updated: "Ultimo aggiornamento: 13 dicembre 2025",
    important: "**IMPORTANTE**: Scaricando, installando o utilizzando l'applicazione Eats OK, accetti incondizionatamente queste Condizioni d'Uso.",
    protection: "Questa applicazione e le sue funzionalità sono protette da copyright e anteriorità.",
    service: "Servizio",
    serviceDesc: "Eats OK è un'applicazione mobile gratuita che ti permette di scansionare prodotti alimentari e verificare se sono soggetti a richiamo.",
    features: "Funzionalità",
    featuresList: `- Scansione tramite fotocamera
- Riconoscimento automatico (marca e lotto)
- Verifica dei richiami
- Notifiche di richiamo
- Cronologia locale`,
    ocr: "Precisione OCR",
    ocrDesc: "Il riconoscimento del testo può contenere errori. Devi sempre verificare visivamente le informazioni rilevate.",
    liability: "Responsabilità",
    liabilityDesc: "L'editore non garantisce l'accuratezza delle informazioni. In caso di richiamo, consulta le fonti ufficiali.",
    data: "Dati",
    dataDesc: "Tutti i tuoi dati sono memorizzati localmente sul tuo dispositivo. Nessuna foto viene inviata a un server.",
    contact: "Contatto"
  },
  pt: {
    title: "Termos de Uso - Eats OK",
    updated: "Última atualização: 13 de dezembro de 2025",
    important: "**IMPORTANTE**: Ao baixar, instalar ou usar o aplicativo Eats OK, você aceita incondicionalmente estes Termos de Uso.",
    protection: "Esta aplicação e suas funcionalidades estão protegidas por direitos autorais e anterioridade.",
    service: "Serviço",
    serviceDesc: "Eats OK é um aplicativo móvel gratuito que permite escanear produtos alimentícios e verificar se estão sujeitos a recall.",
    features: "Funcionalidades",
    featuresList: `- Digitalizar com câmera
- Reconhecimento automático (marca e lote)
- Verificação de recalls
- Notificações de recall
- Histórico local`,
    ocr: "Precisão OCR",
    ocrDesc: "O reconhecimento de texto pode conter erros. Você deve sempre verificar visualmente as informações detectadas.",
    liability: "Responsabilidade",
    liabilityDesc: "O editor não garante a precisão das informações. Em caso de recall, consulte fontes oficiais.",
    data: "Dados",
    dataDesc: "Todos os seus dados são armazenados localmente em seu dispositivo. Nenhuma foto é enviada para um servidor.",
    contact: "Contato"
  },
  ar: {
    title: "شروط الاستخدام - Eats OK",
    updated: "آخر تحديث: 13 ديسمبر 2025",
    important: "**مهم**: بتنزيل أو تثبيت أو استخدام تطبيق Eats OK، فإنك توافق دون قيد أو شرط على شروط الاستخدام هذه.",
    protection: "هذا التطبيق ووظائفه محمية بموجب حقوق النشر والأسبقية.",
    service: "الخدمة",
    serviceDesc: "Eats OK هو تطبيق جوال مجاني يتيح لك مسح المنتجات الغذائية والتحقق مما إذا كانت خاضعة للاستدعاء.",
    features: "الميزات",
    featuresList: `- المسح عبر الكاميرا
- التعرف التلقائي (العلامة التجارية والدفعة)
- التحقق من عمليات الاستدعاء
- إشعارات الاستدعاء
- السجل المحلي`,
    ocr: "دقة التعرف الضوئي",
    ocrDesc: "قد يحتوي التعرف على النص على أخطاء. يجب عليك دائمًا التحقق بصريًا من المعلومات المكتشفة.",
    liability: "المسؤولية",
    liabilityDesc: "الناشر لا يضمن دقة المعلومات. في حالة الاستدعاء، استشر المصادر الرسمية.",
    data: "البيانات",
    dataDesc: "يتم تخزين جميع بياناتك محليًا على جهازك. لا يتم إرسال أي صورة إلى الخادم.",
    contact: "اتصل"
  },
  ru: {
    title: "Условия использования - Eats OK",
    updated: "Последнее обновление: 13 декабря 2025",
    important: "**ВАЖНО**: Загружая, устанавливая или используя приложение Eats OK, вы безоговорочно принимаете настоящие Условия использования.",
    protection: "Это приложение и его функциональность защищены авторским правом и приоритетом.",
    service: "Сервис",
    serviceDesc: "Eats OK - это бесплатное мобильное приложение, позволяющее сканировать продукты питания и проверять, подлежат ли они отзыву.",
    features: "Функции",
    featuresList: `- Сканирование с помощью камеры
- Автоматическое распознавание (марка и партия)
- Проверка отзывов
- Уведомления об отзывах
- Локальная история`,
    ocr: "Точность OCR",
    ocrDesc: "Распознавание текста может содержать ошибки. Вы всегда должны визуально проверять обнаруженную информацию.",
    liability: "Ответственность",
    liabilityDesc: "Издатель не гарантирует точность информации. В случае отзыва обратитесь к официальным источникам.",
    data: "Данные",
    dataDesc: "Все ваши данные хранятся локально на вашем устройстве. Ни одна фотография не отправляется на сервер.",
    contact: "Контакт"
  },
  zh: {
    title: "使用条款 - Eats OK",
    updated: "最后更新：2025年12月13日",
    important: "**重要**：下载、安装或使用 Eats OK 应用程序即表示您无条件接受本使用条款。",
    protection: "本应用程序及其功能受版权和优先权保护。",
    service: "服务",
    serviceDesc: "Eats OK 是一款免费的移动应用程序，允许您扫描食品并检查它们是否被召回。",
    features: "功能",
    featuresList: `- 通过相机扫描
- 自动识别（品牌和批次）
- 召回验证
- 召回通知
- 本地历史记录`,
    ocr: "OCR 准确性",
    ocrDesc: "文本识别可能包含错误。您必须始终目视验证检测到的信息。",
    liability: "责任",
    liabilityDesc: "发布者不保证信息的准确性。如有召回，请查阅官方来源。",
    data: "数据",
    dataDesc: "您的所有数据都存储在您的设备本地。没有照片被发送到服务器。",
    contact: "联系方式"
  },
  ja: {
    title: "利用規約 - Eats OK",
    updated: "最終更新：2025年12月13日",
    important: "**重要**：Eats OK アプリケーションをダウンロード、インストール、または使用することにより、本利用規約に無条件で同意するものとします。",
    protection: "このアプリケーションとその機能は、著作権および優先権によって保護されています。",
    service: "サービス",
    serviceDesc: "Eats OK は、食品をスキャンしてリコールの対象となっているかどうかを確認できる無料のモバイルアプリケーションです。",
    features: "機能",
    featuresList: `- カメラでスキャン
- 自動認識（ブランドとロット）
- リコール確認
- リコール通知
- ローカル履歴`,
    ocr: "OCR 精度",
    ocrDesc: "テキスト認識にはエラーが含まれる場合があります。検出された情報は常に目視で確認する必要があります。",
    liability: "責任",
    liabilityDesc: "発行者は情報の正確性を保証しません。リコールの場合は、公式ソースを参照してください。",
    data: "データ",
    dataDesc: "すべてのデータはデバイスにローカルに保存されます。写真がサーバーに送信されることはありません。",
    contact: "お問い合わせ"
  },
  nl: {
    title: "Gebruiksvoorwaarden - Eats OK",
    updated: "Laatste update: 13 december 2025",
    important: "**BELANGRIJK**: Door de Eats OK-applicatie te downloaden, installeren of gebruiken, accepteert u onvoorwaardelijk deze Gebruiksvoorwaarden.",
    protection: "Deze applicatie en haar functionaliteiten zijn beschermd door auteursrecht en voorrang.",
    service: "Service",
    serviceDesc: "Eats OK is een gratis mobiele applicatie waarmee u voedingsproducten kunt scannen en controleren of ze onderhevig zijn aan een terugroeping.",
    features: "Functionaliteiten",
    featuresList: `- Scannen via camera
- Automatische herkenning (merk en partij)
- Verificatie van terugroepingen
- Terugroepingsmeldingen
- Lokale geschiedenis`,
    ocr: "OCR-nauwkeurigheid",
    ocrDesc: "Tekstherkenning kan fouten bevatten. U moet de gedetecteerde informatie altijd visueel verifiëren.",
    liability: "Aansprakelijkheid",
    liabilityDesc: "De uitgever garandeert niet de nauwkeurigheid van informatie. In geval van terugroeping, raadpleeg officiële bronnen.",
    data: "Gegevens",
    dataDesc: "Al uw gegevens worden lokaal op uw apparaat opgeslagen. Geen enkele foto wordt naar een server verzonden.",
    contact: "Contact"
  },
  sq: {
    title: "Kushtet e Përdorimit - Eats OK",
    updated: "Përditësimi i fundit: 13 dhjetor 2025",
    important: "**E RËNDËSISHME**: Duke shkarkuar, instaluar ose përdorur aplikacionin Eats OK, ju pranoni pa kushte këto Kushte të Përdorimit.",
    protection: "Ky aplikacion dhe funksionalitetet e tij janë të mbrojtura nga e drejta e autorit dhe përparësia.",
    service: "Shërbimi",
    serviceDesc: "Eats OK është një aplikacion celular falas që ju lejon të skanoni produkte ushqimore dhe të kontrolloni nëse ato janë objekt i një tërheqjeje.",
    features: "Funksionalitetet",
    featuresList: `- Skanim përmes kamerës
- Njohje automatike (marka dhe numri i lotit)
- Verifikimi i tërheqjeve
- Njoftime për tërheqje
- Historik lokal`,
    ocr: "Saktësia OCR",
    ocrDesc: "Njohja e tekstit mund të përmbajë gabime. Ju duhet të verifikoni gjithmonë vizualisht informacionin e zbuluar.",
    liability: "Përgjegjësia",
    liabilityDesc: "Botori nuk garanton saktësinë e informacionit. Në rast tërheqjeje, konsultoni burimet zyrtare.",
    data: "Të dhënat",
    dataDesc: "Të gjitha të dhënat tuaja ruhen lokalisht në pajisjen tuaj. Asnjë foto nuk dërgohet në një server.",
    contact: "Kontakti"
  },
  sr: {
    title: "Uslovi korišćenja - Eats OK",
    updated: "Poslednje ažuriranje: 13. decembar 2025",
    important: "**VAŽNO**: Preuzimanjem, instaliranjem ili korišćenjem aplikacije Eats OK, bezuslovno prihvatate ove Uslove korišćenja.",
    protection: "Ova aplikacija i njene funkcionalnosti su zaštićene autorskim pravom i prioritetom.",
    service: "Usluga",
    serviceDesc: "Eats OK je besplatna mobilna aplikacija koja vam omogućava da skenirate prehrambene proizvode i proverite da li su predmet opoziva.",
    features: "Funkcionalnosti",
    featuresList: `- Skeniranje putem kamere
- Automatsko prepoznavanje (marka i serija)
- Verifikacija opoziva
- Obaveštenja o opozivima
- Lokalna istorija`,
    ocr: "OCR tačnost",
    ocrDesc: "Prepoznavanje teksta može sadržati greške. Uvek morate vizuelno proveriti otkrivene informacije.",
    liability: "Odgovornost",
    liabilityDesc: "Izdavač ne garantuje tačnost informacija. U slučaju opoziva, konsultujte zvanične izvore.",
    data: "Podaci",
    dataDesc: "Svi vaši podaci se čuvaju lokalno na vašem uređaju. Nijedna fotografija se ne šalje na server.",
    contact: "Kontakt"
  },
  me: {
    title: "Uslovi korišćenja - Eats OK",
    updated: "Posljednje ažuriranje: 13. decembar 2025",
    important: "**VAŽNO**: Preuzimanjem, instaliranjem ili korištenjem aplikacije Eats OK, bezuslovno prihvatate ove Uslove korišćenja.",
    protection: "Ova aplikacija i njene funkcionalnosti su zaštićene autorskim pravom i prioritetom.",
    service: "Usluga",
    serviceDesc: "Eats OK je besplatna mobilna aplikacija koja vam omogućava da skenirate prehrambene proizvode i provjerite da li su predmet opoziva.",
    features: "Funkcionalnosti",
    featuresList: `- Skeniranje putem kamere
- Automatsko prepoznavanje (marka i serija)
- Verifikacija opoziva
- Obavještenja o opozivima
- Lokalna istorija`,
    ocr: "OCR tačnost",
    ocrDesc: "Prepoznavanje teksta može sadržati greške. Uvijek morate vizuelno provjeriti otkrivene informacije.",
    liability: "Odgovornost",
    liabilityDesc: "Izdavač ne garantuje tačnost informacija. U slučaju opoziva, konsultujte zvanične izvore.",
    data: "Podaci",
    dataDesc: "Svi vaši podaci se čuvaju lokalno na vašem uređaju. Nijedna fotografija se ne šalje na server.",
    contact: "Kontakt"
  }
};

function generateCGU(lang, translation) {
  const protectionLine = lang === 'en'
    ? 'This application and its functionalities are protected by copyright and prior art.'
    : `${translation.protection}\nThis application and its functionalities are protected by copyright and prior art.`;

  return `# ${translation.title}

*${translation.updated}*

${translation.important}

${protectionLine}

---

## 1. ${translation.service}

${translation.serviceDesc}

## 2. ${translation.features}

${translation.featuresList}

## 3. ${translation.ocr}

${translation.ocrDesc}

## 4. ${translation.liability}

${translation.liabilityDesc}

## 5. ${translation.data}

${translation.dataDesc}

## 6. ${translation.contact}

Email : legal@eatsok.app
`;
}

// Créer les fichiers pour chaque langue
const legalDir = path.join(__dirname, '..', 'legal');
if (!fs.existsSync(legalDir)) {
  fs.mkdirSync(legalDir, { recursive: true });
}

// Français (déjà créé, on le copie juste)
console.log('Generating CGU files...\n');

Object.keys(translations).forEach(lang => {
  const content = generateCGU(lang, translations[lang]);
  const filePath = path.join(legalDir, `CGU_${lang}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Created: ${filePath}`);
});

console.log('\n✨ All CGU translation files have been created successfully!');
