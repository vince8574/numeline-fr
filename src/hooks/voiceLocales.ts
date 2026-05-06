// Mapping locales app -> locales TTS/STT + patterns regex + contextual strings
// Pour le mode malvoyant (commandes vocales et guidage)

export type AppLocale =
  | 'fr' | 'en' | 'de' | 'es' | 'it'
  | 'ar' | 'zh' | 'ja' | 'nl' | 'pt'
  | 'ru' | 'sq' | 'sr' | 'me';

export type VoicePatterns = {
  photo: RegExp;
  flashWord: RegExp;
  flashOff: RegExp;
};

export type VoiceLocaleConfig = {
  speechLocale: string; // BCP-47 utilisé par TTS (expo-speech) et STT (expo-speech-recognition)
  patterns: VoicePatterns;
  contextualStrings: string[]; // hints donnés au moteur STT
};

const FALLBACK_LOCALE: AppLocale = 'en';

const REGISTRY: Record<AppLocale, VoiceLocaleConfig> = {
  fr: {
    speechLocale: 'fr-FR',
    patterns: {
      photo: /\b(photo|prends?\s+(?:une\s+|en\s+|la\s+)?photo|prendre\s+(?:une\s+|en\s+|la\s+)?photo|captur(?:e|er)|cliché|capt[ue]re)\b/i,
      flashWord: /\b(flash|lampe|torche|lumi[èe]re|éclair(?:age|e))\b/i,
      flashOff: /\b(enlev(?:e|er|ez)|enlève|éteins|éteindre|éteignez|coup(?:e|er|ez)|stop|arr[êe]t(?:e|er|ez)?|d[ée]sactiv(?:e|er|ez)|off|sans)\b/i
    },
    contextualStrings: ['photo', 'prends en photo', 'capture', 'flash', 'enlever flash', 'éteindre flash', 'lampe', 'torche']
  },
  en: {
    speechLocale: 'en-US',
    patterns: {
      photo: /\b(photo|take\s+(?:a\s+)?(?:photo|picture)|capture|shot|click|snap|picture)\b/i,
      flashWord: /\b(flash|torch|light|lamp)\b/i,
      flashOff: /\b(off|no|stop|disable|turn\s+off|kill|cancel|without|remove)\b/i
    },
    contextualStrings: ['photo', 'take a photo', 'capture', 'flash', 'flash off', 'no flash', 'turn off flash', 'torch']
  },
  de: {
    speechLocale: 'de-DE',
    patterns: {
      photo: /\b(foto|bild|aufnehmen|aufnahme|knipsen|schießen|schiessen|kamera|aufnimm)\b/i,
      flashWord: /\b(blitz|licht|lampe|taschenlampe)\b/i,
      flashOff: /\b(aus|abschalten|deaktivieren|stop|stopp|ausschalten|kein|ohne|entferne)\b/i
    },
    contextualStrings: ['foto', 'aufnehmen', 'kamera', 'blitz', 'blitz aus', 'lampe', 'taschenlampe']
  },
  es: {
    speechLocale: 'es-ES',
    patterns: {
      photo: /\b(foto|fotograf[ií]a|captura(?:r)?|tomar\s+(?:una\s+)?foto|hacer\s+(?:una\s+)?foto|disparo)\b/i,
      flashWord: /\b(flash|luz|linterna|l[áa]mpara)\b/i,
      flashOff: /\b(quita(?:r)?|apaga(?:r)?|sin|stop|para(?:r)?|desactiva(?:r)?|fuera|cancela(?:r)?)\b/i
    },
    contextualStrings: ['foto', 'tomar foto', 'capturar', 'flash', 'apaga flash', 'quita flash', 'linterna']
  },
  it: {
    speechLocale: 'it-IT',
    patterns: {
      photo: /\b(foto|fotografia|scatta(?:re)?|cattur(?:a|are)|fai\s+(?:una\s+)?foto|riprendi)\b/i,
      flashWord: /\b(flash|luce|torcia|lampada)\b/i,
      flashOff: /\b(spegn(?:i|ere|ete)|togli|stop|via|disattiva|senza|annulla)\b/i
    },
    contextualStrings: ['foto', 'scatta foto', 'cattura', 'flash', 'spegni flash', 'togli flash', 'torcia']
  },
  nl: {
    speechLocale: 'nl-NL',
    patterns: {
      photo: /\b(foto|maak\s+(?:een\s+)?foto|fotograf(?:eer|eren)|opname|knip|knippen|kiek)\b/i,
      flashWord: /\b(flits|licht|lamp|zaklamp)\b/i,
      flashOff: /\b(uit|stop|verwijder|geen|deactiveer|annuleer|zonder)\b/i
    },
    contextualStrings: ['foto', 'maak foto', 'flits', 'flits uit', 'licht', 'zaklamp']
  },
  pt: {
    speechLocale: 'pt-PT',
    patterns: {
      photo: /\b(foto|fotografia|tirar\s+(?:uma\s+)?foto|capturar|fotografar|disparar)\b/i,
      flashWord: /\b(flash|luz|lanterna|l[âa]mpada)\b/i,
      flashOff: /\b(desliga(?:r)?|apaga(?:r)?|sem|para(?:r)?|stop|tira(?:r)?|desativa(?:r)?|cancela(?:r)?)\b/i
    },
    contextualStrings: ['foto', 'tirar foto', 'capturar', 'flash', 'desliga flash', 'apaga flash', 'lanterna']
  },
  ru: {
    speechLocale: 'ru-RU',
    patterns: {
      photo: /(фото|снимок|снять|сфотограф|кадр|щёлкни|щелкни|снимай)/i,
      flashWord: /(вспышк|фонарик|свет|фонарь|подсветк)/i,
      flashOff: /(выключ|откл|без|стоп|убери|отмени|нет)/i
    },
    contextualStrings: ['фото', 'снимок', 'сфотографировать', 'вспышка', 'выключи вспышку', 'фонарик']
  },
  ar: {
    speechLocale: 'ar-SA',
    patterns: {
      photo: /(صورة|التقط|التقاط|كاميرا|صور)/i,
      flashWord: /(فلاش|ضوء|مصباح|كشاف|إضاءة)/i,
      flashOff: /(إيقاف|أطفئ|أوقف|بدون|إلغاء|اطفاء)/i
    },
    contextualStrings: ['صورة', 'التقط صورة', 'فلاش', 'إيقاف الفلاش', 'مصباح']
  },
  zh: {
    speechLocale: 'zh-CN',
    patterns: {
      photo: /(照片|拍照|拍摄|拍|抓拍|相机)/i,
      flashWord: /(闪光灯|手电筒|灯|闪光|照明)/i,
      flashOff: /(关|关闭|停止|取消|没有|不要|关掉)/i
    },
    contextualStrings: ['拍照', '照片', '拍摄', '闪光灯', '关闭闪光灯', '手电筒']
  },
  ja: {
    speechLocale: 'ja-JP',
    patterns: {
      photo: /(写真|撮影|撮って|撮る|シャッター|撮影して)/i,
      flashWord: /(フラッシュ|ライト|ランプ|懐中電灯)/i,
      flashOff: /(オフ|消す|止める|停止|消して|消灯|なし)/i
    },
    contextualStrings: ['写真', '撮影', '写真を撮って', 'フラッシュ', 'フラッシュ オフ', 'ライト']
  },
  sq: {
    speechLocale: 'sq-AL',
    patterns: {
      photo: /\b(foto|fotograf|kap|fotografo|kliko|nis|merr\s+foto)\b/i,
      flashWord: /\b(blic|drit[ëe]|elektrik|llamb|fener)\b/i,
      flashOff: /\b(fik|nd[ie]rpre|stop|pa|hiq|fikur|c‌aktivizo)\b/i
    },
    contextualStrings: ['foto', 'merr foto', 'blic', 'fik blicun', 'drita']
  },
  sr: {
    speechLocale: 'sr-RS',
    patterns: {
      photo: /(foto|slika|fotografisa|snimi|uslikaj|клик|снимак|фото|slikaj)/i,
      flashWord: /(blic|svetlo|baterij|lampa|блиц|светло|лампа)/i,
      flashOff: /(isključi|ugasi|stop|bez|искљ|угаси|isključ)/i
    },
    contextualStrings: ['foto', 'slika', 'snimi', 'blic', 'isključi blic', 'svetlo']
  },
  me: {
    speechLocale: 'sr-Latn-ME',
    patterns: {
      photo: /(foto|slika|fotografisa|snimi|uslikaj|slikaj)/i,
      flashWord: /(blic|svjetlo|svetlo|baterij|lampa)/i,
      flashOff: /(isključi|ugasi|stop|bez|isključ)/i
    },
    contextualStrings: ['foto', 'slika', 'snimi', 'blic', 'isključi blic']
  }
};

function normalize(locale: string | undefined | null): AppLocale {
  if (!locale) return FALLBACK_LOCALE;
  const code = locale.toLowerCase().split(/[-_]/)[0] as AppLocale;
  if (code in REGISTRY) return code;
  return FALLBACK_LOCALE;
}

export function getVoiceLocaleConfig(locale: string | undefined | null): VoiceLocaleConfig {
  return REGISTRY[normalize(locale)];
}

export function getSpeechLocale(locale: string | undefined | null): string {
  return REGISTRY[normalize(locale)].speechLocale;
}
