/* Public settings for the Family feature. These values are safe to ship in the app: the Supabase anon key only
   allows what the database's row-level security allows (see supabase/migrations/0001_family.sql).
   Never put the Supabase service_role key here. Setup steps: docs/FAMILY_SETUP.md */
window.BD = window.BD || {};
BD.CONFIG = {
  supabaseUrl: 'https://pzigdxwuudmairtncphw.supabase.co',        // e.g. https://abcdefghijklmnop.supabase.co
  supabaseKey: 'sb_publishable_QDQwJnfRgPW9kdAs05gJuQ_FPypTQ7C',        // the project's anon / publishable key
  googleWebClientId: '',    // OAuth "Web application" client ID (used for Android sign-in too)
  googleIosClientId: '',    // OAuth "iOS" client ID (iOS sign-in only; see docs/FAMILY_SETUP.md)
  // Optional donations (docs/DONATIONS.md). These are the in-app product IDs to create in Play Console and
  // App Store Connect, as consumable products. Empty list = the donation buttons stay hidden.
  donationProducts: ['donate_small', 'donate_medium', 'donate_large']
};
