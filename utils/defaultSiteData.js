// ================================================================
//  BioXape — Default Site Data (seed on first run)
//  FILE: utils/defaultSiteData.js
// ================================================================

module.exports = {
  ticker: {
    items: [
      { label: "BREAKING", text: "FDA approves first CRISPR-based therapy for sickle cell disease in paediatric patients", active: true },
      { label: "RESEARCH", text: "AlphaFold 3 update predicts protein-ligand interactions with 91% accuracy", active: true },
      { label: "INDUSTRY", text: "Biocon reports 34% YoY growth in biosimilar exports Q1 2026", active: true },
      { label: "FUNDING",  text: "India DBT allocates Rs 1200 Cr for synthetic biology research hubs across IITs and IISc", active: true },
      { label: "EVENT",    text: "BioAsia 2026 open for registration - Hyderabad July 18 to 20", active: true }
    ]
  },

  hero_featured: {
    title: "CRISPR Prime Editing Achieves 94% Precision",
    excerpt: "A landmark study demonstrates that next-generation base editors can near-eliminate unintended genomic changes.",
    authorName: "Dr. Deepa Rao",
    authorInitials: "DR",
    category: "CRISPR",
    date: "May 7, 2026",
    coverGradient: "linear-gradient(145deg,#0c4d2c,#1a8a50,#3db87a)"
  },

  hero_stack: {
    items: [
      { title: "Biocon mRNA Plant Goes Live - 200M Doses Capacity", meta: "May 6 · 5 min", emoji: "🧫", themeClass: "th-a", tagText: "Industry", tagClass: "ta" },
      { title: "AlphaFold 3 vs RoseTTAFold: Head-to-Head Benchmark", meta: "May 5 · 7 min", emoji: "🔬", themeClass: "th-b", tagText: "Research", tagClass: "tb" },
      { title: "GM Mustard Gets Final Approval - India First Biotech Crop", meta: "May 4 · 4 min", emoji: "🌱", themeClass: "th-p", tagText: "AgriTech", tagClass: "tp" },
      { title: "CAR-T Therapy Succeeds in Autoimmune Conditions", meta: "May 3 · 6 min", emoji: "💊", themeClass: "th-r", tagText: "Medical", tagClass: "tr" }
    ]
  },

  category_nav: {
    items: [
      { label: "Genomics & Gene Editing",                bloggerLabel: "Genomics_GeneEditing",            active: true, order: 0 },
      { label: "Biopharmaceuticals",                     bloggerLabel: "Biopharmaceuticals_DrugDiscovery", active: true, order: 1 },
      { label: "Bioinformatics",                         bloggerLabel: "Bioinformatics",                  active: true, order: 2 },
      { label: "Synthetic Biology",                      bloggerLabel: "SyntheticBiology_ProteinEngineering", active: true, order: 3 },
      { label: "Industrial Biotechnology",                bloggerLabel: "IndustrialBiotechnology",          active: true, order: 4 },
      { label: "Agricultural Biotechnology",             bloggerLabel: "AgriculturalBiotechnology",         active: true, order: 5 },
      { label: "Clinical Trials & Industry News",        bloggerLabel: "ClinicalTrials_IndustryNews",     active: true, order: 6 }
    ]
  },

  news_strip: {
    items: [
      { text: "WHO publishes updated Global Biosafety Framework impacting BSL-4 lab regulations worldwide", tagText: "Regulatory", tagClass: "tr", timeAgo: "2h ago", active: true },
      { text: "India DBT allocates Rs 1200 Cr for synthetic biology research hubs across IITs and IISc",   tagText: "Funding",    tagClass: "tg", timeAgo: "5h ago", active: true },
      { text: "Moderna personalised cancer mRNA vaccine shows 50% reduction in recurrence in Phase III",   tagText: "Clinical",   tagClass: "tb", timeAgo: "8h ago", active: true }
    ]
  },

  trending: {
    mode: "manual",
    items: [
      { postId: "", title: "CRISPR in Human Embryos: Where Science Meets Ethics", reads: "6.2K", timeAgo: "3 days ago" },
      { postId: "", title: "India Biotech Policy 2026: Complete Breakdown",        reads: "4.8K", timeAgo: "5 days ago" },
      { postId: "", title: "AlphaFold 3 vs RoseTTAFold: Full Benchmark Results",  reads: "3.9K", timeAgo: "5 days ago" },
      { postId: "", title: "5 Free Bioinformatics Tools Every Researcher Needs",  reads: "2.7K", timeAgo: "1 week ago" }
    ]
  },

  subscription_plans: {
    plans: [
      {
        id: "free", icon: "🌱", name: "Free", price: 0, currency: "INR", period: "month",
        desc: "For curious minds just getting started",
        features: [
          { text: "5 articles per month", included: true },
          { text: "Weekly newsletter",    included: true },
          { text: "News and trending feed", included: true },
          { text: "Research paper summaries", included: false },
          { text: "Ad-free reading", included: false },
          { text: "Course discounts",    included: false }
        ],
        razorpayPlanId: "", buttonText: "Get Started Free", isFeatured: false
      },
      {
        id: "pro", icon: "🔬", name: "Pro Researcher", price: 349, currency: "INR", period: "month",
        desc: "For scientists, students and professionals",
        features: [
          { text: "Unlimited articles",       included: true },
          { text: "All research summaries",   included: true },
          { text: "100% ad-free experience",  included: true },
          { text: "PDF and EPUB downloads",   included: true },
          { text: "25% off all courses",      included: true },
          { text: "Early content access",     included: true },
          { text: "Members-only newsletter",  included: true }
        ],
        razorpayPlanId: "", buttonText: "Subscribe Now", isFeatured: true
      },
      {
        id: "institutional", icon: "🏛️", name: "Institutional", price: 1199, currency: "INR", period: "month",
        desc: "For labs, universities and research teams",
        features: [
          { text: "Up to 15 user seats",       included: true },
          { text: "All Pro features included", included: true },
          { text: "Team dashboard",            included: true },
          { text: "Custom branded newsletter", included: true },
          { text: "API data access",           included: true },
          { text: "Priority editorial support",included: true }
        ],
        razorpayPlanId: "", buttonText: "Contact Us", isFeatured: false
      }
    ]
  },

  courses: {
    items: [
      { icon: "🧬", themeClass: "ci1", level: "Intermediate · Self-Paced · Certificate", title: "CRISPR: From Fundamentals to Clinical Applications", meta: "8 modules · 6 hours · 2,400 students enrolled", price: "₹1,499", oldPrice: "", enrollUrl: "#" },
      { icon: "💻", themeClass: "ci2", level: "Beginner · Self-Paced · Certificate", title: "Bioinformatics with Python: Sequence to Structure", meta: "12 modules · 10 hours · 1,800 students enrolled", price: "₹1,999", oldPrice: "", enrollUrl: "#" },
      { icon: "🤖", themeClass: "ci3", level: "Advanced · Live + Recorded · Certificate", title: "AI and Drug Discovery: AlphaFold, Docking and De Novo Design", meta: "6 modules · 8 hours · Live Q&A · 940 enrolled", price: "₹2,499", oldPrice: "₹3,499", enrollUrl: "#" },
      { icon: "📊", themeClass: "ci4", level: "All Levels · eBook · Instant Download", title: "The 2026 India Biotech Industry Report: Trends Funding and Forecasts", meta: "128 pages · PDF + EPUB · Updated monthly", price: "₹799", oldPrice: "", enrollUrl: "#" }
    ]
  },

  store: {
    items: [
      { emoji: "📓", themeClass: "si1", name: "BioXApe Lab Notebook", type: "Hardcover · Branded Merch",     price: "₹499",   oldPrice: "",       cartUrl: "#" },
      { emoji: "🖼️", themeClass: "si2", name: "PCR Protocol Poster Set", type: "Digital Download · A2 Print", price: "₹249",   oldPrice: "₹399",   cartUrl: "#" },
      { emoji: "👕", themeClass: "si3", name: "DNA Helix Tee",           type: "Unisex Merch · S to 3XL",     price: "₹849",   oldPrice: "",       cartUrl: "#" },
      { emoji: "📦", themeClass: "si4", name: "Researcher Starter Bundle", type: "Bundle · 4 eBooks + Poster", price: "₹1,399", oldPrice: "₹2,400", cartUrl: "#" }
    ]
  },

  footer: {
    socialLinks: { twitter: "#", linkedin: "#", youtube: "#", instagram: "#", researchgate: "#" },
    copyrightText: "2026 BioXApe. All rights reserved. Made with dedication in India.",
    newsletterHeading: "Weekly Science Digest",
    newsletterSubtext: "Top biotech stories every week."
  },
  
  latest_articles: {
    title: "Latest Articles",
    limit: 6,
    showCoverImage: true
  },

  research_spotlight: {
    hero: {
      journal: "Nature Biotechnology · May 2026",
      ifScore: "54.9",
      title: "In Vivo Epigenome Editing Restores Vision",
      excerpt: "A breakthrough epigenome editing tool successfully reverses cellular aging hallmarks in ocular tissues.",
      paperUrl: "https://www.nature.com/nbt",
      stats: [
        { value: "8.2x", label: "Increased efficacy" },
        { value: "0", label: "Off-target effects" },
        { value: "12m", label: "Therapeutic retention" },
        { value: "FDA", label: "Fast-track status" }
      ]
    },
    cards: [
      {
        journal: "Science · April 2026",
        title: "Synthetic Genomes Created from Scratch",
        excerpt: "Researchers synthesize the entire chromosome structure of yeast, paving the way for custom biological manufacturing.",
        paperUrl: "https://www.science.org"
      },
      {
        journal: "Cell · March 2026",
        title: "CAR-T Cells Programmed to Target Cancer Stealth Vectors",
        excerpt: "Newly engineered receptors bypass solid tumour shield barriers to trigger complete elimination.",
        paperUrl: "https://www.cell.com"
      }
    ]
  },

  adsense_slots: {
    leaderboard1:    { code: "", active: false },
    leaderboard2:    { code: "", active: false },
    sidebar_300x250: { code: "", active: false },
    in_article:      { code: "", active: false }
  },

  site_meta: {
    siteName:    "BioXApe",
    tagline:     "Where Biotechnology Meets Clarity",
    description: "Your trusted source for biotechnology insights, peer-reviewed research summaries, and science communication.",
    keywords:    "biotechnology, CRISPR, genomics, bioinformatics, synthetic biology, biotech news India",
    logoUrl:     "",
    faviconUrl:  ""
  }
};
