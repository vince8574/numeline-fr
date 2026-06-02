import { create } from 'zustand';

// Prix localisés réels renvoyés par le store (Google Play / App Store) via
// react-native-iap. Clé = productId, valeur = displayPrice (ex. "5,99 €",
// "$6.99", "¥980" — déjà dans la devise du pays de l'utilisateur).
//
// Indispensable pour la conformité Google Play : le prix affiché dans la
// paywall DOIT correspondre exactement à celui du panier de paiement, sinon
// l'app est refusée pour « différences de devises ».
type IapPriceStore = {
  prices: Record<string, string>;
  setPrices: (prices: Record<string, string>) => void;
};

export const useIapPriceStore = create<IapPriceStore>((set) => ({
  prices: {},
  setPrices: (prices) => set((state) => ({ prices: { ...state.prices, ...prices } })),
}));
