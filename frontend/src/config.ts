// ============================================================
//   TARA APP CONFIGURATION
//   Bhutanese Archery Parimutuel Betting Platform
// ============================================================

const config = {
  // ----------------------------------------------------------
  // APP INFO
  // ----------------------------------------------------------
  appName: "Tara",
  appDescription: "Bhutanese Archery Prediction Markets - Bet with BTN or TON",
  version: "1.0.0-phase1",

  // ----------------------------------------------------------
  // TELEGRAM BOT
  // ----------------------------------------------------------
  botUsername: "Tara_parimutuel_bot",
  botToken: "8689268702:AAEW70VsF9M98SAPz4YM9bs-0GJWHxaacaM",

  // ----------------------------------------------------------
  // DEPLOYMENT URL
  // The public URL where your app will be hosted
  // ----------------------------------------------------------
  appUrl: "https://tara-parimutuel.vercel.app",

  // ----------------------------------------------------------
  // TON CONNECT (for crypto wallet connection)
  // ----------------------------------------------------------
  tonConnectIconUrl:
    "https://tara-parimutuel.vercel.app/icons/icon-192x192.png",

  // ----------------------------------------------------------
  // PAYMENT METHODS (Phase 1: Bhutan Launch)
  // ----------------------------------------------------------
  payments: {
    // DK Bank (Druk PNB Bank) - Primary for Bhutanese users
    dkBank: {
      enabled: true,
      merchantId: "", // TODO: Add your DK Bank merchant ID
      apiUrl: "https://dkpnb.bt/api", // TODO: Verify DK Bank API endpoint
      currency: "BTN", // Bhutanese Ngultrum
      minBet: 50, // Minimum 50 BTN (~$0.60 USD)
    },

    // TON Wallet - Secondary for crypto users
    ton: {
      enabled: true,
      platformWallet: "EQD...", // TODO: Add your TON wallet address for receiving payments
      currency: "TON",
      minBet: 0.5, // Minimum 0.5 TON
    },

    // Credits - For testing/demo (no real money)
    credits: {
      enabled: true,
      starterBalance: 1000,
    },
  },

  // ----------------------------------------------------------
  // MARKET SETTINGS (Bhutanese Archery)
  // ----------------------------------------------------------
  markets: {
    sport: "Bhutanese Archery",
    defaultHouseEdge: 5, // 5% house edge
    categories: [
      "National Championship",
      "District Tournament",
      "Village Match",
      "Special Events",
    ],
  },

  // ----------------------------------------------------------
  // LMSR ODDS CALCULATION (Logarithmic Market Scoring Rule)
  // Provides smooth, always-defined probability displays
  // ----------------------------------------------------------
  lmsr: {
    enabled: true,
    liquidityParam: 1000, // b = 1000 BTN (controls market sensitivity)
    displayFormat: "both", // "probability" | "odds" | "both"
    // Note: Settlement still uses parimutuel pool redistribution
  },

  // ----------------------------------------------------------
  // LOCALIZATION (Phase 1: Bhutan)
  // ----------------------------------------------------------
  locale: {
    country: "BT", // Bhutan
    language: "en", // English primary, Dzongkha optional
    timezone: "Asia/Thimphu",
    currency: "BTN",
  },
};

export default config;
