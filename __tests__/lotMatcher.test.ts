import { getRecallStatus, matchLots } from '../src/utils/lotMatcher';
import { RecallRecord, ScannedProduct } from '../src/types';

const product: ScannedProduct = {
  id: '1',
  brand: 'Test',
  lotNumber: 'L12345',
  scannedAt: Date.now(),
  recallStatus: 'unknown'
};

const recall: RecallRecord = {
  id: 'recall-1',
  title: 'Produit rappelé',
  lotNumbers: ['L12345'],
  country: 'FR',
  publishedAt: new Date().toISOString()
};

describe('lotMatcher', () => {
  it('matches identical lot numbers', () => {
    expect(matchLots(product, recall)).toBe(true);
  });

  it('returns recall status when match is found', () => {
    const result = getRecallStatus(product, [recall]);
    expect(result.status).toBe('recalled');
    expect(result.recallReference).toBe('recall-1');
  });

  it('returns safe when no match', () => {
    const result = getRecallStatus(product, [
      { ...recall, lotNumbers: ['L9999'], id: 'recall-2' }
    ]);
    expect(result.status).toBe('safe');
  });
});
