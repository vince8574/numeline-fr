export type RecallStatus = 'unknown' | 'safe' | 'recalled' | 'warning';

export type CountryCode = 'FR' | 'US' | 'CH';

export type ScannedProduct = {
  id: string;
  brand: string;
  lotNumber: string;
  scannedAt: number;
  recallStatus: RecallStatus;
  recallReference?: string;
  lastCheckedAt?: number;
  productName?: string;
  productImage?: string;
};

export type RecallRecord = {
  id: string;
  title: string;
  description?: string;
  lotNumbers: string[];
  brand?: string;
  productCategory?: string;
  country: CountryCode;
  publishedAt: string;
  link?: string;
  imageUrl?: string;
};

export type OCRResult = {
  text: string;
  confidence?: number;
  lines: Array<{ content: string; confidence?: number }>;
  source?: 'mlkit' | 'vision-fallback' | 'cloud-ocr' | 'none';
};

export type ApiError = {
  message: string;
  code?: string;
  status?: number;
};
