const fs = require('fs');
const path = require('path');

const translations = {
  ar: {
    sectionTitle: "الوثائق القانونية",
    privacyPolicy: "سياسة الخصوصية",
    terms: "شروط الخدمة",
    legalNotice: "الإشعار القانوني",
    errorLoading: "خطأ في تحميل الوثيقة"
  },
  de: {
    sectionTitle: "Rechtsdokumente",
    privacyPolicy: "Datenschutzerklärung",
    terms: "Nutzungsbedingungen",
    legalNotice: "Impressum",
    errorLoading: "Fehler beim Laden des Dokuments"
  },
  es: {
    sectionTitle: "Documentos Legales",
    privacyPolicy: "Política de Privacidad",
    terms: "Términos y Condiciones",
    legalNotice: "Aviso Legal",
    errorLoading: "Error al cargar el documento"
  },
  it: {
    sectionTitle: "Documenti Legali",
    privacyPolicy: "Informativa sulla Privacy",
    terms: "Termini di Servizio",
    legalNotice: "Note Legali",
    errorLoading: "Errore nel caricamento del documento"
  },
  ja: {
    sectionTitle: "法的文書",
    privacyPolicy: "プライバシーポリシー",
    terms: "利用規約",
    legalNotice: "法的通知",
    errorLoading: "ドキュメントの読み込みエラー"
  },
  me: {
    sectionTitle: "Pravni dokumenti",
    privacyPolicy: "Politika privatnosti",
    terms: "Uslovi korišćenja",
    legalNotice: "Pravna obavještenja",
    errorLoading: "Greška pri učitavanju dokumenta"
  },
  nl: {
    sectionTitle: "Juridische Documenten",
    privacyPolicy: "Privacybeleid",
    terms: "Algemene Voorwaarden",
    legalNotice: "Juridische Kennisgeving",
    errorLoading: "Fout bij het laden van document"
  },
  pt: {
    sectionTitle: "Documentos Legais",
    privacyPolicy: "Política de Privacidade",
    terms: "Termos de Serviço",
    legalNotice: "Aviso Legal",
    errorLoading: "Erro ao carregar documento"
  },
  ru: {
    sectionTitle: "Юридические документы",
    privacyPolicy: "Политика конфиденциальности",
    terms: "Условия использования",
    legalNotice: "Правовая информация",
    errorLoading: "Ошибка загрузки документа"
  },
  sq: {
    sectionTitle: "Dokumente Ligjore",
    privacyPolicy: "Politika e Privatësisë",
    terms: "Kushtet e Shërbimit",
    legalNotice: "Njoftim Ligjor",
    errorLoading: "Gabim në ngarkimin e dokumentit"
  },
  sr: {
    sectionTitle: "Pravni dokumenti",
    privacyPolicy: "Politika privatnosti",
    terms: "Uslovi korišćenja",
    legalNotice: "Pravna obaveštenja",
    errorLoading: "Greška pri učitavanju dokumenta"
  },
  zh: {
    sectionTitle: "法律文件",
    privacyPolicy: "隐私政策",
    terms: "服务条款",
    legalNotice: "法律声明",
    errorLoading: "文档加载错误"
  }
};

const localesDir = path.join(__dirname, '../src/i18n/locales');

Object.keys(translations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);

  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Add legal section if it doesn't exist
    if (!data.legal) {
      data.legal = translations[lang];

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`✓ Added legal translations to ${lang}.json`);
    } else {
      console.log(`- ${lang}.json already has legal translations`);
    }
  }
});

console.log('\nDone!');
