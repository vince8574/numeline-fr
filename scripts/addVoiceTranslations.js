/* Ajoute les nouvelles clés du mode malvoyant (UI + voice) dans tous les locales. */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

// Traductions par langue
const TRANSLATIONS = {
  de: {
    accessibilityToggleTitle: 'Sehbehinderten-Modus',
    accessibilityToggleHint: 'Hoher Kontrast, große Schrift, Sprachführung und Sprachbefehle.',
    lowLightHint: "Wenig Licht. Tippen oder sagen Sie 'Blitz' zum Einschalten / 'Blitz aus' zum Ausschalten.",
    scanLotReady: 'Chargennummer-Modus. Zentrieren Sie die Nummer im Rahmen. Sagen Sie Foto zum Aufnehmen, Blitz zum Einschalten, Blitz aus zum Ausschalten.',
    scanLotTip: 'Halten Sie das Telefon ruhig. Sagen Sie Foto zum Aufnehmen, Blitz zum Einschalten, Blitz aus zum Ausschalten.',
    lotInFrame: 'Chargennummer im Bild sichtbar. Sagen Sie Foto, um sie aufzunehmen.',
    lowLight: 'Wenig Licht. Sagen Sie Blitz zum Einschalten, Blitz aus zum Ausschalten.',
    flashOn: 'Blitz an. Sagen Sie Blitz aus zum Ausschalten.',
    flashOff: 'Blitz aus.',
    photoCommand: 'Aufnahme läuft.',
    voiceCommandsReady: 'Sprachbefehle aktiv. Sagen Sie Foto zum Aufnehmen, Blitz zum Einschalten, Blitz aus zum Ausschalten.'
  },
  es: {
    accessibilityToggleTitle: 'Modo baja visión',
    accessibilityToggleHint: 'Alto contraste, texto grande, guía y comandos de voz.',
    lowLightHint: "Luz insuficiente. Toca aquí o di 'flash' para encender / 'apaga flash' para apagar.",
    scanLotReady: 'Modo número de lote. Centra el número en el recuadro. Di foto para capturar, flash para encender, apaga flash para apagar.',
    scanLotTip: 'Mantén el teléfono firme. Di foto para capturar, flash para encender, apaga flash para apagar.',
    lotInFrame: 'Número de lote visible. Di foto para capturarlo.',
    lowLight: 'Luz insuficiente. Di flash para encender, apaga flash para apagar.',
    flashOn: 'Flash encendido. Di apaga flash para apagar.',
    flashOff: 'Flash apagado.',
    photoCommand: 'Capturando.',
    voiceCommandsReady: 'Comandos de voz activos. Di foto para capturar, flash para encender, apaga flash para apagar.'
  },
  it: {
    accessibilityToggleTitle: 'Modalità ipovedenti',
    accessibilityToggleHint: 'Alto contrasto, testo ingrandito, guida e comandi vocali.',
    lowLightHint: "Luce insufficiente. Tocca qui o di' 'flash' per accendere / 'spegni flash' per spegnere.",
    scanLotReady: "Modalità numero di lotto. Centra il numero nella banda. Di' foto per scattare, flash per accendere, spegni flash per spegnere.",
    scanLotTip: "Tieni il telefono fermo. Di' foto per scattare, flash per accendere, spegni flash per spegnere.",
    lotInFrame: "Numero di lotto visibile. Di' foto per catturarlo.",
    lowLight: "Luce insufficiente. Di' flash per accendere, spegni flash per spegnere.",
    flashOn: "Flash acceso. Di' spegni flash per spegnere.",
    flashOff: 'Flash spento.',
    photoCommand: 'Cattura in corso.',
    voiceCommandsReady: "Comandi vocali attivi. Di' foto per scattare, flash per accendere, spegni flash per spegnere."
  },
  nl: {
    accessibilityToggleTitle: 'Slechtziendenmodus',
    accessibilityToggleHint: 'Hoog contrast, groot lettertype, spraakhulp en spraakopdrachten.',
    lowLightHint: "Weinig licht. Tik hier of zeg 'flits' om aan te zetten / 'flits uit' om uit te zetten.",
    scanLotReady: 'Lotnummer modus. Centreer het nummer in het kader. Zeg foto om vast te leggen, flits om aan te zetten, flits uit om uit te zetten.',
    scanLotTip: 'Houd de telefoon stil. Zeg foto om vast te leggen, flits om aan te zetten, flits uit om uit te zetten.',
    lotInFrame: 'Lotnummer zichtbaar. Zeg foto om vast te leggen.',
    lowLight: 'Weinig licht. Zeg flits om aan te zetten, flits uit om uit te zetten.',
    flashOn: 'Flits aan. Zeg flits uit om uit te zetten.',
    flashOff: 'Flits uit.',
    photoCommand: 'Opname bezig.',
    voiceCommandsReady: 'Spraakopdrachten actief. Zeg foto om vast te leggen, flits om aan te zetten, flits uit om uit te zetten.'
  },
  pt: {
    accessibilityToggleTitle: 'Modo baixa visão',
    accessibilityToggleHint: 'Alto contraste, texto ampliado, guia e comandos de voz.',
    lowLightHint: "Luz fraca. Toque aqui ou diga 'flash' para ligar / 'apaga flash' para desligar.",
    scanLotReady: 'Modo número de lote. Centra o número no quadro. Diz foto para capturar, flash para ligar, apaga flash para desligar.',
    scanLotTip: 'Mantém o telefone estável. Diz foto para capturar, flash para ligar, apaga flash para desligar.',
    lotInFrame: 'Número de lote visível. Diz foto para o capturar.',
    lowLight: 'Luz fraca. Diz flash para ligar, apaga flash para desligar.',
    flashOn: 'Flash ligado. Diz apaga flash para desligar.',
    flashOff: 'Flash desligado.',
    photoCommand: 'A capturar.',
    voiceCommandsReady: 'Comandos de voz ativos. Diz foto para capturar, flash para ligar, apaga flash para desligar.'
  },
  ar: {
    accessibilityToggleTitle: 'وضع ضعاف البصر',
    accessibilityToggleHint: 'تباين عالي، نص كبير، توجيه وأوامر صوتية.',
    lowLightHint: "إضاءة منخفضة. انقر هنا أو قل 'فلاش' للتشغيل / 'إيقاف الفلاش' للإيقاف.",
    scanLotReady: 'وضع رقم الدفعة. ضع الرقم في الإطار. قل صورة للالتقاط، فلاش للتشغيل، إيقاف الفلاش للإيقاف.',
    scanLotTip: 'حافظ على ثبات الهاتف. قل صورة للالتقاط، فلاش للتشغيل، إيقاف الفلاش للإيقاف.',
    lotInFrame: 'رقم الدفعة ظاهر. قل صورة لالتقاطه.',
    lowLight: 'إضاءة منخفضة. قل فلاش للتشغيل، إيقاف الفلاش للإيقاف.',
    flashOn: 'الفلاش مشغّل. قل إيقاف الفلاش للإيقاف.',
    flashOff: 'تم إيقاف الفلاش.',
    photoCommand: 'جاري الالتقاط.',
    voiceCommandsReady: 'الأوامر الصوتية مفعّلة. قل صورة للالتقاط، فلاش للتشغيل، إيقاف الفلاش للإيقاف.'
  },
  zh: {
    accessibilityToggleTitle: '弱视模式',
    accessibilityToggleHint: '高对比度、大字体、语音提示和语音命令。',
    lowLightHint: '光线不足。点此处或说"闪光灯"开启 / "关闭闪光灯"关闭。',
    scanLotReady: '批号模式。将批号置于框内。说"拍照"拍摄，"闪光灯"打开，"关闭闪光灯"关闭。',
    scanLotTip: '保持手机稳定。说"拍照"拍摄，"闪光灯"打开，"关闭闪光灯"关闭。',
    lotInFrame: '批号可见。说"拍照"以捕获。',
    lowLight: '光线不足。说"闪光灯"打开，"关闭闪光灯"关闭。',
    flashOn: '闪光灯已打开。说"关闭闪光灯"关闭。',
    flashOff: '闪光灯已关闭。',
    photoCommand: '正在拍摄。',
    voiceCommandsReady: '语音命令已启用。说"拍照"拍摄，"闪光灯"打开，"关闭闪光灯"关闭。'
  },
  ja: {
    accessibilityToggleTitle: '弱視モード',
    accessibilityToggleHint: '高コントラスト、大きな文字、音声ガイドと音声コマンド。',
    lowLightHint: '光量不足。ここをタップするか「フラッシュ」と言ってオン /「フラッシュ オフ」でオフ。',
    scanLotReady: 'ロット番号モード。番号を枠内に合わせてください。「写真」で撮影、「フラッシュ」でオン、「フラッシュ オフ」でオフ。',
    scanLotTip: '電話を安定させてください。「写真」で撮影、「フラッシュ」でオン、「フラッシュ オフ」でオフ。',
    lotInFrame: 'ロット番号が表示されています。「写真」と言って撮影してください。',
    lowLight: '光量不足。「フラッシュ」でオン、「フラッシュ オフ」でオフ。',
    flashOn: 'フラッシュ オンです。「フラッシュ オフ」でオフ。',
    flashOff: 'フラッシュ オフです。',
    photoCommand: '撮影中。',
    voiceCommandsReady: '音声コマンド有効。「写真」で撮影、「フラッシュ」でオン、「フラッシュ オフ」でオフ。'
  },
  ru: {
    accessibilityToggleTitle: 'Режим для слабовидящих',
    accessibilityToggleHint: 'Высокий контраст, крупный шрифт, голосовая навигация и команды.',
    lowLightHint: "Мало света. Нажмите здесь или скажите 'вспышка' чтобы включить / 'выключи вспышку' чтобы выключить.",
    scanLotReady: 'Режим номера партии. Поместите номер в рамку. Скажите фото для съемки, вспышка для включения, выключи вспышку для выключения.',
    scanLotTip: 'Держите телефон ровно. Скажите фото для съемки, вспышка для включения, выключи вспышку для выключения.',
    lotInFrame: 'Номер партии виден. Скажите фото, чтобы его захватить.',
    lowLight: 'Мало света. Скажите вспышка для включения, выключи вспышку для выключения.',
    flashOn: 'Вспышка включена. Скажите выключи вспышку для выключения.',
    flashOff: 'Вспышка выключена.',
    photoCommand: 'Снимок.',
    voiceCommandsReady: 'Голосовые команды активны. Скажите фото для съемки, вспышка для включения, выключи вспышку для выключения.'
  },
  sq: {
    accessibilityToggleTitle: 'Modaliteti për personat me shikim të dobët',
    accessibilityToggleHint: 'Kontrast i lartë, tekst i madh, udhëzime dhe komanda zanore.',
    lowLightHint: "Dritë e pamjaftueshme. Prek ose thuaj 'blic' për ta ndezur / 'fik blicun' për ta fikur.",
    scanLotReady: 'Modaliteti i numrit të lotit. Vendos numrin brenda kornizës. Thuaj foto për të kapur, blic për të ndezur, fik blicun për të fikur.',
    scanLotTip: 'Mbaje telefonin të qëndrueshëm. Thuaj foto për të kapur, blic për të ndezur, fik blicun për të fikur.',
    lotInFrame: 'Numri i lotit i dukshëm. Thuaj foto për ta kapur.',
    lowLight: 'Dritë e pamjaftueshme. Thuaj blic për të ndezur, fik blicun për të fikur.',
    flashOn: 'Blici është ndezur. Thuaj fik blicun për ta fikur.',
    flashOff: 'Blici është fikur.',
    photoCommand: 'Po kapet.',
    voiceCommandsReady: 'Komandat zanore aktive. Thuaj foto për të kapur, blic për të ndezur, fik blicun për të fikur.'
  },
  sr: {
    accessibilityToggleTitle: 'Režim za slabovide',
    accessibilityToggleHint: 'Visok kontrast, veliki tekst, glasovno vođenje i komande.',
    lowLightHint: "Slabo svetlo. Dodirni ili reci 'blic' za uključenje / 'isključi blic' za isključenje.",
    scanLotReady: 'Režim broja partije. Centriraj broj u okviru. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.',
    scanLotTip: 'Drži telefon mirno. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.',
    lotInFrame: 'Broj partije vidljiv. Reci foto da ga uslikaš.',
    lowLight: 'Slabo svetlo. Reci blic za uključenje, isključi blic za isključenje.',
    flashOn: 'Blic uključen. Reci isključi blic za isključenje.',
    flashOff: 'Blic isključen.',
    photoCommand: 'Snimanje u toku.',
    voiceCommandsReady: 'Glasovne komande aktivne. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.'
  },
  me: {
    accessibilityToggleTitle: 'Režim za slabovide',
    accessibilityToggleHint: 'Visok kontrast, veliki tekst, glasovno vođenje i komande.',
    lowLightHint: "Slabo svjetlo. Dodirni ili reci 'blic' za uključenje / 'isključi blic' za isključenje.",
    scanLotReady: 'Režim broja partije. Centriraj broj u okviru. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.',
    scanLotTip: 'Drži telefon mirno. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.',
    lotInFrame: 'Broj partije vidljiv. Reci foto da ga uslikaš.',
    lowLight: 'Slabo svjetlo. Reci blic za uključenje, isključi blic za isključenje.',
    flashOn: 'Blic uključen. Reci isključi blic za isključenje.',
    flashOff: 'Blic isključen.',
    photoCommand: 'Snimanje u toku.',
    voiceCommandsReady: 'Glasovne komande aktivne. Reci foto za snimanje, blic za uključenje, isključi blic za isključenje.'
  }
};

function ensure(obj, key, defaultValue) {
  if (obj[key] === undefined || obj[key] === null) obj[key] = defaultValue;
  return obj[key];
}

for (const [locale, t] of Object.entries(TRANSLATIONS)) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[skip] ${locale}.json not found`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  // home.accessibilityToggle
  ensure(data, 'home', {});
  data.home.accessibilityToggle = {
    title: t.accessibilityToggleTitle,
    hint: t.accessibilityToggleHint
  };

  // scan.lowLightHint
  ensure(data, 'scan', {});
  data.scan.lowLightHint = t.lowLightHint;

  // accessibility.voice.*
  ensure(data, 'accessibility', {});
  ensure(data.accessibility, 'voice', {});
  const v = data.accessibility.voice;
  v.scanLotReady = t.scanLotReady;
  v.scanLotTip = t.scanLotTip;
  v.lotInFrame = t.lotInFrame;
  v.lowLight = t.lowLight;
  v.flashOn = t.flashOn;
  v.flashOff = t.flashOff;
  v.photoCommand = t.photoCommand;
  v.voiceCommandsReady = t.voiceCommandsReady;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[ok] ${locale}.json updated`);
}

console.log('\nDone.');
