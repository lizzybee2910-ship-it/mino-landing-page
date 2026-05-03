import glpStrongImage from "@assets/Gemini_Generated_Image_k838m4k838m4k838_1777229044551.png";

export type RegulatoryStatus =
  | "FDA-approved (brand)"
  | "Investigational"
  | "Research use"
  | "Cosmetic";

export type CompoundForm =
  | "Lyophilized vial"
  | "Injectable solution"
  | "Injectable / nasal"
  | "Oral capsule"
  | "Oral"
  | "Oral / topical"
  | "Topical"
  | "Nasal / intranasal"
  | "Research use";

export interface Compound {
  name: string;
  form: CompoundForm;
  status: RegulatoryStatus;
  use: string;
  description?: string;
  idealFor?: string;
  image?: string;
}

export type CategoryNumeral =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "V"
  | "VI"
  | "VII"
  | "VIII"
  | "IX";

export interface Category {
  number: string;
  numeral: CategoryNumeral;
  slug: string;
  title: string;
  tagline: string;
  overview: string;
  applications: string;
  practiceNote: { label: string; body: string };
  compounds: Compound[];
}

export const TOTAL_COMPOUNDS = 35;
export const TOTAL_CATEGORIES = 9;
export const TOTAL_TIERS = 3;

export const CATEGORIES: Category[] = [
  {
    number: "01",
    numeral: "I",
    slug: "weight-management",
    title: "Weight Management",
    tagline:
      "Incretin and adjunctive compounds for medical weight management, glycemic control, and body composition.",
    overview:
      "Weight management sits at the intersection of the most clinically validated and the most rapidly evolving segments of the peptide market. Incretin therapy has moved from endocrinology into mainstream primary care, aesthetic practice, and longevity medicine. Mino supplies both FDA-approved branded incretins where a legitimate dispensing pathway exists and a curated set of investigational multi-agonist compounds for qualified clinical and research settings. Regulatory status is disclosed at the compound level and again at the order level.",
    applications:
      "Medical weight management programs · Endocrinology-adjacent practices · Longevity and preventive medicine · Body composition and aesthetic optimization · Clinical research environments",
    practiceNote: {
      label: "Supply chain notes",
      body: "Weight management compounds represent the most regulated segment of the portfolio. Mino maintains documented chain-of-custody for every lot and works exclusively with manufacturing partners whose facilities we have verified. Where a branded FDA-approved agent is not commercially viable, Mino supplies investigational multi-agonist compounds under research-use documentation.",
    },
    compounds: [
      {
        name: "GLP3-RT",
        form: "Lyophilized vial",
        status: "Investigational",
        use: "Triple GLP-1 / GIP / Glucagon receptor agonist for weight management research",
        description:
          "The first triple incretin agonist class. Up to ~24% weight loss in Phase 2 trials — the highest efficacy ever recorded in the category. Adds direct fat oxidation via glucagon receptor activation on top of dual incretin appetite suppression.",
        idealFor:
          "Patients seeking maximum results; those who plateaued on dual agonists; advanced metabolic protocols",
        image: glpStrongImage,
      },
      {
        name: "Tirzepatide",
        form: "Lyophilized vial",
        status: "FDA-approved (brand)",
        use: "Dual GLP-1 / GIP receptor agonist for weight management and glycemic control",
        description:
          "The lead dual-pathway metabolic compound. Up to ~22.5% weight loss in clinical trials. Once-weekly injection with dual-pathway appetite reduction and superior glycemic control over single-pathway agonists.",
        idealFor:
          "BMI \u226527, Type 2 diabetes, metabolic syndrome, aesthetic weight loss",
      },
      {
        name: "Cagrilintide",
        form: "Lyophilized vial",
        status: "Investigational",
        use: "Long-acting amylin analog, satiety and weight regulation",
        description:
          "Acylated amylin analog with extended half-life. Targets satiety pathways distinct from GLP-1 — frequently combined with incretins in research protocols for additive weight loss without additional GI burden.",
        idealFor:
          "Stack add-on for incretin protocols; patients seeking non-incretin satiety support",
      },
      {
        name: "AOD-9604",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Lipolytic fragment of human growth hormone",
        description:
          "Modified HGH fragment (aa 177-191). Stimulates targeted lipolysis without growth-promoting or diabetogenic effects. No blood sugar impact. No IGF-1 elevation.",
        idealFor:
          "Patients who can't tolerate GLP-1s; athletes; targeted body composition",
      },
    ],
  },
  {
    number: "02",
    numeral: "II",
    slug: "recovery-healing",
    title: "Recovery & Healing",
    tagline:
      "Compounds indicated in tissue repair, gastrointestinal healing, connective tissue recovery, and post-injury regeneration.",
    overview:
      "Recovery and healing peptides are among the most clinically studied compounds in the portfolio, with substantial preclinical literature and growing human investigational data. BPC-157 and TB-500 have become cornerstones of integrative musculoskeletal protocols. ARA-290 has been investigated in tissue protection contexts. Mino supplies these primarily to orthopedic, integrative, and post-surgical care settings where documented sourcing matters as much as the clinical outcome.",
    applications:
      "Orthopedic and sports medicine practices · Integrative medicine clinics · Regenerative aesthetic practices · Post-surgical recovery programs · Gastroenterology support protocols",
    practiceNote: {
      label: "Storage & handling",
      body: "Lyophilized vials are shipped at ambient temperature and should be refrigerated upon receipt. Reconstituted product should be used within manufacturer-specified stability windows. All compounds ship with lot-specific storage documentation and a Certificate of Analysis from an independent testing laboratory.",
    },
    compounds: [
      {
        name: "BPC-157",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Gastrointestinal repair, tendon and ligament recovery",
        description:
          "15-amino-acid gastric peptide with 100+ published studies. Accelerates healing of muscles, tendons, ligaments, nerves, and GI tract. Universal tissue repair with unmatched clinical depth.",
        idealFor:
          "Athletes, post-surgical, GI issues, tendon/ligament injuries — broadest appeal",
      },
      {
        name: "TB-500",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Soft tissue repair, inflammation modulation",
        description:
          "43-amino-acid peptide (Thymosin Beta-4) promoting cell migration and blood vessel formation. Cardioprotective with documented hair follicle activation.",
        idealFor:
          "Slow-healing wounds, cardiac patients, hair thinning, musculoskeletal injuries",
      },
      {
        name: "Wolverine (BPC-157 / TB-500)",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Combined regenerative protocol — tissue repair stack",
        description:
          "The two most widely used regenerative peptides co-formulated in a single vial. Synergy across soft tissue, GI, and connective tissue repair pathways — the de-facto standard recovery stack.",
        idealFor:
          "Post-surgical, orthopedic injury, complex soft-tissue cases needing both pathways",
      },
      {
        name: "ARA-290",
        form: "Lyophilized vial",
        status: "Investigational",
        use: "Tissue protection and small fiber neuropathy research",
        description:
          "11-amino-acid erythropoietin-derived peptide retaining cytoprotective signaling without erythropoietic effect. Investigated for neuropathic pain, sarcoidosis, and inflammatory tissue injury.",
        idealFor:
          "Neuropathic pain protocols; inflammatory tissue injury; investigational settings",
      },
    ],
  },
  {
    number: "03",
    numeral: "III",
    slug: "immune-stack",
    title: "Immune Stack",
    tagline:
      "Compounds with documented roles in immune modulation, antimicrobial defense, and mucosal protection.",
    overview:
      "The immune stack contains compounds at the intersection of antimicrobial defense, immune modulation, and mucosal repair. Thymosin-Alpha 1 has a regulatory history as an approved agent outside the United States and continues to be studied in immune-mediated conditions. LL-37 and KPV are research-use compounds with documented mechanisms in chronic infection and inflammatory disease contexts. VIP is supplied for investigational use in chronic inflammatory and biotoxin protocols.",
    applications:
      "Functional and integrative medicine · Chronic infection programs · Post-viral and chronic inflammatory care · Immune support adjuncts to oncology · Clinical research",
    practiceNote: {
      label: "Clinical context",
      body: "Several compounds in this category are dispensed primarily into chronic-infection and complex-case practice settings. Mino clinical reference materials describe administration routes, dosing ranges in published literature, and stability considerations on a per-compound basis.",
    },
    compounds: [
      {
        name: "LL-37",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Antimicrobial cathelicidin, immunomodulatory",
        description:
          "Human cathelicidin with broad-spectrum antimicrobial activity. Disrupts biofilms at the source. A cornerstone of immune defense and wound healing.",
        idealFor:
          "Chronic infections, Lyme, biofilm conditions, immune-compromised, wound healing",
      },
      {
        name: "KPV",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Anti-inflammatory tripeptide, mucosal healing",
        description:
          "Alpha-MSH derived tripeptide. Potent NF-kB inhibitor with oral bioavailability — particularly effective for gut inflammation.",
        idealFor:
          "IBD, Crohn's, UC, IBS, chronic inflammatory skin conditions, steroid alternatives",
      },
      {
        name: "Thymosin-Alpha 1",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Immune support, post-viral recovery protocols",
        description:
          "28-amino-acid thymic peptide approved in 35+ countries. Enhances T-cell and NK cell function through immune modulation — not suppression. Decades of safety data.",
        idealFor:
          "Chronic infections, cancer immune support, Lyme, post-COVID, immune-compromised",
      },
      {
        name: "VIP",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Vasoactive Intestinal Peptide, immune and inflammatory regulation",
        description:
          "28-amino-acid neuropeptide with broad immunomodulatory activity. Dispensed primarily into chronic inflammatory response (CIRS) and biotoxin-illness protocols where downregulation of TGF-beta-1 and inflammatory cytokines is a clinical objective.",
        idealFor:
          "CIRS, mold-illness, chronic inflammatory protocols under specialist supervision",
      },
    ],
  },
  {
    number: "04",
    numeral: "IV",
    slug: "longevity",
    title: "Longevity & Cellular Health",
    tagline:
      "Compounds studied in the context of cellular aging, mitochondrial function, telomere biology, and healthspan extension.",
    overview:
      "Longevity medicine has emerged as one of the fastest-growing segments of private clinical practice. The compounds in this category are not approved for anti-aging indications, and we are explicit with our accounts that they are supplied for research and investigational use within appropriately structured clinical settings. The scientific rationale ranges from well-established mechanisms (NAD+ in mitochondrial bioenergetics) to early-stage hypotheses. Mino provides clinical reference material for each compound describing the current state of evidence — not marketing claims.",
    applications:
      "Longevity and preventive medicine practices · Functional medicine clinics · Concierge and executive health programs · Clinical research environments",
    practiceNote: {
      label: "Evidence standards",
      body: "Mino clinical reference documents cite primary literature where it exists and clearly label the distinction between preclinical findings, early human data, and established clinical outcomes.",
    },
    compounds: [
      {
        name: "NAD+",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Cellular energy and redox support",
        description:
          "Essential coenzyme for energy production, DNA repair, and sirtuin activation. Endogenous levels decline ~50% by age 60. The gateway longevity compound.",
        idealFor:
          "Anyone over 35; fatigue; brain fog; athletes; metabolic patients",
      },
      {
        name: "MOTS-C",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Mitochondrial-derived peptide, metabolic regulation",
        description:
          "Mitochondrial-encoded peptide activating AMPK — the same pathway as exercise. Improves insulin sensitivity and fat oxidation at the cellular level.",
        idealFor:
          "Longevity patients; those who can't exercise; metabolic optimization; athletes",
      },
      {
        name: "5-Amino-1MQ",
        form: "Oral capsule",
        status: "Research use",
        use: "NNMT inhibitor under investigation for metabolic and longevity modulation",
        description:
          "Oral NNMT inhibitor blocking the fat-storage enzyme while boosting intracellular NAD+. No injection required — a rare oral option in the longevity category.",
        idealFor:
          "Injection-averse patients; biohackers; add-on to injectable protocols",
      },
      {
        name: "Epithalon",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Telomerase activation, pineal-axis research",
        description:
          "Synthetic tetrapeptide activating telomerase and maintaining telomere length. Regulates the melatonin-cortisol cycle. Decades of gerontological research.",
        idealFor:
          "Longevity-focused patients; sleep issues; the optimization community",
      },
    ],
  },
  {
    number: "05",
    numeral: "V",
    slug: "growth-hormone",
    title: "Growth Hormone Support",
    tagline:
      "Compounds associated with growth hormone-axis modulation, recovery, lean tissue support, and healthy aging.",
    overview:
      "Growth hormone-axis peptides have a long history of use in integrative and sports medicine contexts. They are among the most clinically familiar peptides in practice, with decades of prescribing experience behind them. Mino emphasizes that these compounds are supplied to credentialed practitioners operating within legitimate medical frameworks, not for direct athletic enhancement. Sermorelin and Tesamorelin carry FDA approval for specific indications.",
    applications:
      "Integrative medicine · Anti-aging and hormone optimization practices · Sports medicine and recovery protocols · Longevity clinics",
    practiceNote: {
      label: "Important",
      body: "Accounts serving athletic populations should be aware of sport-governing-body restrictions on growth hormone-axis compounds. Mino does not supply compounds intended to circumvent competitive sport regulations.",
    },
    compounds: [
      {
        name: "CJC-1295",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Long-acting GHRH analog",
        description:
          "Modified GHRH with an extended half-life (DAC variant) producing a sustained, physiologic GH pulse. Almost universally paired with a GHRP such as Ipamorelin.",
        idealFor:
          "Standard GH optimization protocols; pairs with Ipamorelin",
      },
      {
        name: "Ipamorelin",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Selective GH secretagogue",
        description:
          "The cleanest GH release of any GHRP — no cortisol, prolactin, or appetite spikes. Almost universally paired with CJC-1295.",
        idealFor: "Standard GH optimization pairing with CJC-1295",
      },
      {
        name: "CJC-1295 / Ipamorelin",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Co-formulated GHRH + GHRP combination, body composition",
        description:
          "The two most clinically familiar growth hormone secretagogues co-formulated in a single vial. Simplifies the standard stack and reduces injection burden.",
        idealFor:
          "Patients on the standard GH optimization stack; simplifying compliance",
      },
      {
        name: "Tesamorelin",
        form: "Lyophilized vial",
        status: "FDA-approved (brand)",
        use: "GHRH analog — visceral adiposity and metabolic health",
        description:
          "The only FDA-approved GH secretagogue (Egrifta). Clinically proven visceral fat reduction with documented cognitive benefits. Premium positioning.",
        idealFor:
          "Visceral adiposity; patients wanting an FDA-backed compound; premium tier",
      },
      {
        name: "Hexarelin",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Potent GH secretagogue, cardiac research",
        description:
          "Strongest GH-releasing peptide of the GHRP family by potency. Cardioprotective signaling distinct from the GH axis itself. Used selectively where high pulse magnitude is the clinical objective.",
        idealFor:
          "Selective GH-secretagogue protocols where Ipamorelin is insufficient",
      },
      {
        name: "Sermorelin",
        form: "Lyophilized vial",
        status: "FDA-approved (brand)",
        use: "GHRH analog, growth hormone support protocols",
        description:
          "The original FDA-approved GHRH analog. The most clinically familiar option for restoring physiologic GH pulsatility in adult deficiency contexts.",
        idealFor:
          "Adult GH-axis support; entry-tier protocols; well-documented safety profile",
      },
    ],
  },
  {
    number: "06",
    numeral: "VI",
    slug: "skin-aesthetics",
    title: "Skin & Aesthetics",
    tagline:
      "Compounds for dermal regeneration, collagen synthesis, hair restoration, and aesthetic practice.",
    overview:
      "Skin and aesthetic peptides are the largest volume segment of Mino's enterprise medical spa business. The category spans cellular signaling compounds (GHK-CU) with deep dermatologic literature, combination aesthetic blends, and melanocortin agonists supplied under research-use documentation. Each sub-segment has its own regulatory framework, and Mino maintains that distinction carefully in both catalog and sales practice.",
    applications:
      "Medical spas and aesthetic practices · Dermatology adjacencies · Hair restoration clinics · Post-procedure recovery programs",
    practiceNote: {
      label: "Enterprise accounts",
      body: "The skin and aesthetics category, together with recovery and healing, represents the largest volume segment of Mino's enterprise medical spa business. Tiered pricing is structured to reward consolidated ordering across categories.",
    },
    compounds: [
      {
        name: "GHK-CU",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Dermal regeneration, collagen synthesis, wound healing",
        description:
          "Natural tripeptide-copper complex activating over 4,000 repair genes. Stimulates Collagen I & III synthesis. Injectable or topical (microneedling). The most validated aesthetic peptide available.",
        idealFor:
          "Skin rejuvenation, post-procedure recovery, hair restoration, anti-aging",
      },
      {
        name: "GLOW",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Aesthetic combination protocol — skin radiance and recovery",
        description:
          "Curated multi-peptide aesthetic blend designed for skin tone, texture, and post-procedure recovery. Dispensed primarily into med-spa practice for cycle-based aesthetic protocols.",
        idealFor:
          "Med-spa cycle programs; post-procedure recovery; aesthetic maintenance",
      },
      {
        name: "Melanotan-1",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Melanocortin-1 receptor agonist research",
        description:
          "Selective alpha-MSH analog with greater MC1 receptor selectivity than Melanotan-2. Studied in photoprotection contexts and erythropoietic protoporphyria. Requires dermatologic monitoring and informed consent.",
        idealFor:
          "Photoprotection research; UV-sensitive patients; specialist supervision",
      },
      {
        name: "Melanotan-2",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Broad melanocortin receptor research",
        description:
          "Alpha-MSH analog stimulating melanogenesis for enhanced tanning with reduced UV exposure. Broader receptor activity than Melanotan-1. Requires dermatologic monitoring and informed consent.",
        idealFor:
          "Fair-skinned patients; tanning with reduced sun exposure — consent required",
      },
    ],
  },
  {
    number: "07",
    numeral: "VII",
    slug: "cognitive",
    title: "Cognitive & Neurological",
    tagline:
      "Compounds studied in the context of focus, memory, neuroprotection, anxiety, and cognitive performance.",
    overview:
      "The cognitive and neurological category contains compounds with neurological research literature ranging from well-established (Semax in nootropic and post-stroke recovery research outside the U.S.) to emerging (Selank in anxiolytic research). Mino supplies these primarily to functional neurology and integrative psychiatry settings operating under investigational frameworks. None of these compounds carry FDA approval for cognitive enhancement indications. Clinical reference materials describe the evidence base honestly.",
    applications:
      "Functional neurology · Integrative psychiatry · Concussion and TBI recovery programs · Longevity and cognitive wellness practices",
    practiceNote: {
      label: "Administration",
      body: "Compounds in this category are commonly administered intranasally, which requires appropriate carrier formulation and patient education. Mino clinical reference materials include administration protocols by compound.",
    },
    compounds: [
      {
        name: "Selank",
        form: "Nasal / intranasal",
        status: "Research use",
        use: "Anxiolytic peptide, GABA modulation research",
        description:
          "Tuftsin analog with GABAergic anxiolytic properties. Anxiety reduction without sedation or dependence. Approved in Russia for generalized anxiety disorder.",
        idealFor:
          "Anxiety patients (non-benzo option); SSRI alternatives; complement to Semax",
      },
      {
        name: "Semax",
        form: "Nasal / intranasal",
        status: "Research use",
        use: "Nootropic, neuroprotection research",
        description:
          "The most popular nootropic peptide in clinical practice. A potent BDNF booster enhancing memory, focus, and learning with neuroprotective effects. Approved in Russia. Fast-acting.",
        idealFor:
          "Executives; professionals; cognitive decline; post-stroke; TBI; students",
      },
    ],
  },
  {
    number: "08",
    numeral: "VIII",
    slug: "sexual-health",
    title: "Sexual Health Stack",
    tagline:
      "Compounds for sexual function, desire, intimacy, and reproductive endocrinology research.",
    overview:
      "The sexual health stack contains compounds operating across distinct biological pathways — central melanocortin signaling (PT-141), oxytocinergic signaling (Oxytocin), and upstream hypothalamic-pituitary-gonadal regulation (Kisspeptin). Each addresses a different axis of sexual function and intimacy. PT-141 carries FDA approval as a branded agent. Kisspeptin is supplied under research-use documentation for reproductive endocrinology and IVF research contexts.",
    applications:
      "Sexual health and intimacy practices · Reproductive endocrinology · Hormone optimization · Couples-medicine programs",
    practiceNote: {
      label: "Counseling",
      body: "Mino expects accounts to provide appropriate informed-consent and counseling around sexual health peptides. Reference materials include patient-facing summaries written for clinical handoff.",
    },
    compounds: [
      {
        name: "Oxytocin",
        form: "Lyophilized vial",
        status: "FDA-approved (brand)",
        use: "Bonding, intimacy, and stress-response research",
        description:
          "Endogenous nonapeptide central to bonding, trust, and pair-bond signaling. Used in sublingual and intranasal protocols outside its FDA-approved obstetric indication.",
        idealFor:
          "Intimacy and couples-medicine protocols; stress-response support",
      },
      {
        name: "PT-141",
        form: "Injectable / nasal",
        status: "FDA-approved (brand)",
        use: "Sexual function, melanocortin agonist",
        description:
          "FDA-approved (Vyleesi). Works on the brain's desire pathway — not blood flow. Effective in both men and women. Fundamentally different mechanism than PDE5 inhibitors.",
        idealFor:
          "Female HSDD; male ED non-responders to Viagra/Cialis; desire enhancement",
      },
      {
        name: "KISSPeptin",
        form: "Lyophilized vial",
        status: "Research use",
        use: "HPG-axis research, reproductive endocrinology",
        description:
          "The upstream regulator of the entire reproductive axis. Triggers GnRH, LH/FSH, and downstream sex steroid production. In IVF: investigated to eliminate ovarian hyperstimulation syndrome.",
        idealFor:
          "Hypothalamic dysfunction; fertility; natural hormone optimization; IVF",
      },
    ],
  },
  {
    number: "09",
    numeral: "IX",
    slug: "specialty",
    title: "Specialty Peptides",
    tagline:
      "Mitochondrial, neurorestorative, and exercise-mimetic compounds at the frontier of investigational practice.",
    overview:
      "The specialty category contains compounds whose mechanisms are individually distinct and whose use is concentrated in advanced functional, longevity, and research practice. Several of these compounds are at the frontier of human investigational use — SS-31 in mitochondrial bioenergetics, SLU-PP-332 in exercise-mimetic research, Pinealon in neurorestorative bioregulator research. Mino supplies these under research-use documentation with full clinical reference materials.",
    applications:
      "Advanced longevity and functional medicine · Mitochondrial research practices · Sleep and circadian medicine · Investigational research environments",
    practiceNote: {
      label: "Specialist use",
      body: "Specialty compounds are typically dispensed into single-specialist or research-program contexts rather than general practice. Many are categorized as Special Order; account managers can confirm lead times and minimum order quantities at the SKU level.",
    },
    compounds: [
      {
        name: "SS-31",
        form: "Lyophilized vial",
        status: "Investigational",
        use: "Mitochondrial-targeted peptide, bioenergetics",
        description:
          "Cell-permeable tetrapeptide (Elamipretide) stabilizing cardiolipin in mitochondrial membranes — restoring energy production at the structural level. Investigated in cardiac, ophthalmologic, and primary mitochondrial disease contexts.",
        idealFor:
          "Longevity patients; cardiac patients; fatigue; age-related decline",
      },
      {
        name: "DSIP",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Delta Sleep-Inducing Peptide, sleep architecture research",
        description:
          "Nine-amino-acid peptide investigated in sleep architecture, stress modulation, and chronic-pain contexts. Dispensed into sleep-medicine research and integrative-psychiatry settings.",
        idealFor:
          "Sleep architecture protocols; stress-axis modulation; chronic-pain research",
      },
      {
        name: "SLU-PP-332",
        form: "Lyophilized vial",
        status: "Research use",
        use: "ERR-agonist, exercise-mimetic research",
        description:
          "Estrogen-related receptor agonist investigated as an exercise mimetic — activating mitochondrial biogenesis and fat oxidation pathways normally engaged by endurance training. One of the most discussed compounds at the frontier of metabolic research.",
        idealFor:
          "Investigational exercise-mimetic protocols; metabolic research; advanced longevity",
      },
      {
        name: "Pinealon",
        form: "Lyophilized vial",
        status: "Research use",
        use: "Neurorestorative bioregulator, cognitive research",
        description:
          "Tripeptide bioregulator from the Khavinson school of peptide research. Investigated in neurorestorative, sleep-circadian, and age-related cognitive contexts.",
        idealFor:
          "Cognitive and neurorestorative research protocols; circadian-axis support",
      },
    ],
  },
];

export interface PricingTier {
  name: string;
  audience: string;
  body: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Tier I",
    audience: "Foundation accounts",
    body: "Single-location practices, new accounts, and introductory volume commitments (10+ units). Standard wholesale pricing and full catalog access.",
  },
  {
    name: "Tier II",
    audience: "Growth accounts",
    body: "Multi-location practices and established volume accounts (25+ units). Preferred pricing, dedicated account management, priority fulfillment.",
  },
  {
    name: "Tier III",
    audience: "Enterprise accounts",
    body: "Multi-state networks, enterprise medical spa groups, and institutional accounts (50+ units). Best wholesale pricing, clinical liaison support, and custom logistics.",
  },
];

export interface RegulatorySection {
  label: string;
  body: string;
}

export const REGULATORY_FRAMEWORK: RegulatorySection[] = [
  {
    label: "Regulatory status, by category",
    body: "Every compound in the catalog is labeled with its current regulatory status: FDA-approved (as a branded agent), Investigational, Research Use, or Cosmetic. These distinctions correspond to real differences in how a compound may lawfully be prescribed, dispensed, compounded, or applied. Our sales team is trained not to elide them.",
  },
  {
    label: "The compounding landscape",
    body: "Recent enforcement activity around GLP-1 and related compounds has reshaped the compounding pharmacy environment. Mino maintains relationships with 503A and 503B facilities whose operating standards meet our expectations and who have not been the subject of adverse enforcement action.",
  },
  {
    label: "Reclassification activity",
    body: "Federal-level signals about peptide reclassification have been well covered in the trade and mainstream press. Mino tracks these developments and updates account-level documentation as the regulatory posture of individual compounds shifts.",
  },
  {
    label: "Off-label vs. research-only",
    body: "The distinction between off-label prescribing of an approved agent and dispensing of a research-only compound is critical and is reflected in how Mino labels, packages, and documents every shipment. We expect our accounts to maintain the same discipline.",
  },
];

export const FOUNDERS_LETTER = {
  eyebrow: "A letter from the founders",
  headline:
    "We built Mino because the clinicians we respected deserved a supply chain that respected them back.",
  paragraphs: [
    "For years, the peptide category was served by a patchwork of research chemical vendors, repackagers, and unverified international sources. The practitioners doing serious clinical work were forced to choose between expedience and integrity, and too often the patient paid the cost of that compromise.",
    "Mino Peptides was founded on a simple premise: that medical-grade therapeutics should be sourced, documented, and delivered to the same standard as the rest of a modern clinical practice. Nothing more, and certainly nothing less.",
    "Our portfolio is deliberately focused. Thirty-five compounds, organized into nine therapeutic categories, each selected because a credentialed clinician might reasonably incorporate it into patient care. We work only with cGMP-compliant manufacturing partners. We verify every lot through third-party analytical testing — \u226599% purity, HPLC and MS verified. We ship through a cold-chain network built for pharmaceuticals, not parcels. And we label our compounds honestly — FDA-approved, investigational, or research-only — because the difference matters.",
    "What follows is the complete portfolio. We hope it serves your practice with the quiet reliability we set out to build.",
  ],
  signatures: [
    { name: "Elizabeth Straus", title: "Chief Executive Officer · Co-founder" },
    { name: "Brandon Howard, MD", title: "Chief Medical Officer · Co-founder" },
  ],
};

export const CREDENTIALING = {
  process:
    "Every Mino account begins with a brief credentialing review. We confirm practitioner licensure, practice location, dispensing or administration authority, and the clinical context in which compounds will be used. This is not bureaucracy for its own sake — it is the basis on which we can stand behind the integrity of the supply chain and make honest representations to our manufacturing partners about the clinical destination of every lot.",
  turnaround:
    "Credentialing is typically completed within three to five business days. First orders ship from our cold-chain fulfillment facility within 48 hours of approval.",
  ordering:
    "Credentialed accounts order through a dedicated wholesale portal with real-time inventory visibility, lot-level documentation, and historical order records. Account managers are available for protocol questions and supply planning.",
  fulfillment:
    "Cold-chain shipping with temperature monitoring, tracked delivery, and signature-required receipt. Overnight and same-day options available for enterprise accounts.",
  contacts: [
    { name: "General inquiries", role: "", email: "hello@mino.life" },
  ],
};

export const STATUS_STYLES: Record<RegulatoryStatus, string> = {
  "FDA-approved (brand)":
    "bg-mino-forest text-mino-cream border-mino-forest",
  Investigational:
    "bg-mino-sage/30 text-mino-forest border-mino-sage-deep/40",
  "Research use":
    "bg-transparent text-mino-forest/85 border-mino-forest/30",
  Cosmetic:
    "bg-mino-bone text-mino-forest/85 border-mino-forest/20",
};
