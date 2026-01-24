import { RecallRecord } from '../types';

/**
 * Extrait la raison du rappel depuis le titre ou la description
 */
export function extractRecallReason(recall: RecallRecord): string {
  const title = recall.title.toLowerCase();
  const description = recall.description?.toLowerCase() || '';

  // Raisons courantes de rappel
  if (title.includes('salmonelle') || description.includes('salmonelle')) {
    return 'Présence de salmonelles';
  }
  if (title.includes('listeria') || description.includes('listeria')) {
    return 'Présence de listeria';
  }
  if (title.includes('e.coli') || title.includes('e. coli') || description.includes('e.coli')) {
    return 'Présence de bactérie E.coli';
  }
  if (title.includes('allergène') || description.includes('allergène')) {
    return 'Allergène non déclaré';
  }
  if (title.includes('corps étranger') || description.includes('corps étranger')) {
    return 'Présence de corps étrangers';
  }
  if (title.includes('verre') || description.includes('verre')) {
    return 'Présence de morceaux de verre';
  }
  if (title.includes('métal') || description.includes('métal')) {
    return 'Présence de particules métalliques';
  }
  if (title.includes('moisissure') || description.includes('moisissure')) {
    return 'Présence de moisissures';
  }
  if (title.includes('toxine') || description.includes('toxine')) {
    return 'Présence de toxines';
  }
  if (title.includes('contamination') || description.includes('contamination')) {
    return 'Contamination microbiologique';
  }
  if (title.includes('pesticide') || description.includes('pesticide')) {
    return 'Présence de pesticides';
  }
  if (title.includes('histamine') || description.includes('histamine')) {
    return 'Taux d\'histamine trop élevé';
  }

  // Si aucune raison spécifique n'est trouvée, retourner vide
  // Le titre complet sera affiché dans le composant RecallAlert
  return '';
}

/**
 * Détermine la gravité du rappel basée sur la raison
 */
export function getRecallSeverity(recall: RecallRecord): 'high' | 'medium' | 'low' {
  const title = recall.title.toLowerCase();
  const description = recall.description?.toLowerCase() || '';
  const text = `${title} ${description}`;

  // Gravité élevée - risques sanitaires graves
  const highSeverityKeywords = [
    'salmonelle',
    'listeria',
    'e.coli',
    'toxine',
    'botulisme',
    'verre',
    'métal',
    'contamination'
  ];

  if (highSeverityKeywords.some(keyword => text.includes(keyword))) {
    return 'high';
  }

  // Gravité moyenne - allergènes et autres risques
  const mediumSeverityKeywords = [
    'allergène',
    'moisissure',
    'pesticide',
    'histamine'
  ];

  if (mediumSeverityKeywords.some(keyword => text.includes(keyword))) {
    return 'medium';
  }

  // Gravité faible - autres raisons
  return 'low';
}
