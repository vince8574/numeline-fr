import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { utils, write } from 'xlsx';
import { ScannedProduct } from '../types';
import { ENTERPRISE_HISTORY_DAYS } from '../constants/subscriptionPlans';

function filterLast6Months(products: ScannedProduct[]): ScannedProduct[] {
  const cutoff = Date.now() - ENTERPRISE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return products.filter((p) => p.scannedAt >= cutoff);
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale.startsWith('fr') ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function statusLabel(status: ScannedProduct['recallStatus'], locale: string): string {
  const isFr = locale.startsWith('fr');
  switch (status) {
    case 'recalled': return isFr ? 'Rappelé' : 'Recalled';
    case 'warning': return isFr ? 'Avertissement' : 'Warning';
    case 'safe': return isFr ? 'Sûr' : 'Safe';
    default: return isFr ? 'Inconnu' : 'Unknown';
  }
}

function statusColor(status: ScannedProduct['recallStatus']): string {
  switch (status) {
    case 'recalled': return '#FF647C';
    case 'warning': return '#FFC857';
    case 'safe': return '#10B981';
    default: return '#A0A0A0';
  }
}

function buildHTML(products: ScannedProduct[], locale: string): string {
  const isFr = locale.startsWith('fr');
  const title = isFr ? 'Historique des scans — numelineFR' : 'Scan History — numelineFR';
  const headers = isFr
    ? ['Date', 'Produit', 'Marque', 'N° Lot', 'Statut']
    : ['Date', 'Product', 'Brand', 'Lot #', 'Status'];

  const rows = products
    .map(
      (p) => `
    <tr>
      <td>${formatDate(p.scannedAt, locale)}</td>
      <td>${p.productName ?? '—'}</td>
      <td>${p.brand}</td>
      <td>${p.lotNumber}</td>
      <td style="color:${statusColor(p.recallStatus)};font-weight:600">${statusLabel(p.recallStatus, locale)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${isFr ? 'fr' : 'en'}">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #1A2D2B; }
  h1 { color: #0BAE86; font-size: 20px; margin-bottom: 4px; }
  p.date { color: #666; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #0BAE86; color: #fff; padding: 8px 12px; text-align: left; }
  td { padding: 7px 12px; border-bottom: 1px solid #E0EDEA; }
  tr:nth-child(even) td { background: #F4FAF8; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="date">${isFr ? 'Généré le' : 'Generated on'} ${formatDate(Date.now(), locale)}</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

export async function exportScanHistory(
  products: ScannedProduct[],
  format: 'pdf' | 'xlsx',
  locale: string
): Promise<void> {
  const filtered = filterLast6Months(products);
  const isFr = locale.startsWith('fr');

  if (format === 'pdf') {
    const html = buildHTML(filtered, locale);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } else {
    const headers = isFr
      ? ['Date', 'Produit', 'Marque', 'N° Lot', 'Statut']
      : ['Date', 'Product', 'Brand', 'Lot #', 'Status'];

    const data = [
      headers,
      ...filtered.map((p) => [
        formatDate(p.scannedAt, locale),
        p.productName ?? '',
        p.brand,
        p.lotNumber,
        statusLabel(p.recallStatus, locale),
      ]),
    ];

    const ws = utils.aoa_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, isFr ? 'Historique' : 'History');

    const xlsxData = write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileUri = `${FileSystem.cacheDirectory}scan_history.xlsx`;
    await FileSystem.writeAsStringAsync(fileUri, xlsxData, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }
}
