/**
 * Static, frontend-only Health Tips & Insights content.
 *
 * Each article powers a card in the home-page "Health Tips & Insights" section,
 * a listing tile on /health-tips, and a full read-more page at
 * /health-tips/:slug. Images are royalty-free Unsplash photos (referenced by
 * their stable photo id and sized on demand via `articleImg()`); YouTube video
 * ids are public educational videos embedded at the bottom of each article.
 *
 * This is deliberately hardcoded — there is no backend, database, or admin
 * surface for health articles.
 */

export interface ArticleVideo {
  /** YouTube video id (the part after `watch?v=`). */
  id: string;
  title: string;
}

export interface ArticleSection {
  heading: string;
  /** One or more short paragraphs. */
  body?: string;
  /** Optional bullet points rendered under the paragraph. */
  points?: string[];
  /** Optional inline illustration (Unsplash photo id). */
  image?: string;
  imageAlt?: string;
}

export interface HealthArticle {
  slug: string;
  category: string;
  /** Material icon name for the category chip. */
  icon: string;
  /** Accent colour (hex) used for chips, links and CTAs on this article. */
  accent: string;
  /** Soft tinted background that pairs with `accent`. */
  accentBg: string;
  /** e.g. "4 min read". */
  readingTime: string;
  title: string;
  /** 2–3 line summary shown on cards. */
  excerpt: string;
  /** Hero / card image (Unsplash photo id). */
  image: string;
  /** Lead paragraph on the article page. */
  intro: string;
  sections: ArticleSection[];
  keyTakeaways: string[];
  conclusion: string;
  videos: ArticleVideo[];
}

/** Build a sized Unsplash URL from a stored photo id. */
export function articleImg(photoId: string, width = 800): string {
  return `https://images.unsplash.com/${photoId}?w=${width}&q=80&auto=format&fit=crop`;
}

export const HEALTH_ARTICLES: HealthArticle[] = [
  // ─────────────────────────────────────────────────────────── 1. Diabetes ──
  {
    slug: '5-early-warning-signs-of-diabetes',
    category: 'Diabetes',
    icon: 'water_drop',
    accent: '#8B5CF6',
    accentBg: '#F3F0FF',
    readingTime: '4 min read',
    title: "5 Early Warning Signs of Diabetes You Shouldn't Ignore",
    excerpt:
      'Diabetes often develops quietly for years before it is diagnosed. Learn the five early signals your body sends so you can act before complications begin.',
    image: 'photo-1505751172876-fa1923c5c528',
    intro:
      'Diabetes is a condition where the body cannot properly control the level of sugar (glucose) in the blood. In its early stages it rarely causes pain, so many people live with high blood sugar for years without knowing. The good news is that the body usually gives quiet warning signs long before serious problems appear. Recognising them early — and confirming with a simple blood test — can protect your eyes, kidneys, heart and nerves.',
    sections: [
      {
        heading: '1. Frequent urination',
        body:
          'When there is too much sugar in your blood, your kidneys work overtime to flush the excess out through urine. This means you may find yourself visiting the toilet far more often than usual, especially waking up several times during the night.',
      },
      {
        heading: '2. Increased thirst',
        body:
          'All that extra urination pulls water out of your body, leaving you dehydrated. Your body responds by making you feel thirsty again and again — a thirst that does not seem to go away no matter how much water you drink.',
        image: 'photo-1579154204601-01588f351e67',
        imageAlt: 'Glass of water being poured',
      },
      {
        heading: '3. Constant fatigue',
        body:
          'Glucose is the fuel your cells use for energy. In diabetes, sugar stays trapped in the blood instead of entering the cells, so your body runs low on fuel. The result is tiredness and weakness that rest does not fully fix.',
      },
      {
        heading: '4. Blurred vision',
        body:
          'High blood sugar can pull fluid into the lens of the eye, changing its shape and making it harder to focus. Vision may become blurry or shift from day to day. This is usually reversible once blood sugar is brought under control.',
      },
      {
        heading: '5. Slow wound healing',
        body:
          'Raised blood sugar damages blood vessels and slows circulation, so cuts, bruises and infections take much longer to heal. Wounds on the feet in particular deserve attention, as they can become serious if ignored.',
      },
      {
        heading: 'When should you get tested?',
        body:
          'If you notice two or more of these signs — or if you are over 40, overweight, or have a family history of diabetes — a simple fasting blood sugar and HbA1c test can give you a clear answer. The HbA1c test shows your average blood sugar over the past three months and needs no special preparation.',
        points: [
          'Fasting Blood Sugar (FBS) — measures sugar after an overnight fast',
          'HbA1c — your 3-month average blood sugar level',
          'Post-prandial sugar — measures sugar 2 hours after a meal',
        ],
      },
    ],
    keyTakeaways: [
      'Early diabetes is often silent — signs are easy to dismiss as everyday tiredness.',
      'Frequent urination and unquenchable thirst are the two most classic early clues.',
      'A simple HbA1c blood test confirms the diagnosis with no fasting required.',
      'Catching it early prevents damage to the eyes, kidneys, heart and nerves.',
    ],
    conclusion:
      'None of these signs on their own means you have diabetes — but together they are your body asking for a check-up. Testing is quick, affordable and can be done from the comfort of your home. Knowing your numbers is the first, most powerful step toward staying healthy.',
    videos: [
      { id: 'JVxq-V1RfNo', title: 'Diabetes Symptoms, Types and Early Warning Signs Explained' },
      { id: 'RTfvWYUS3DI', title: "Diabetes Symptoms You Should Never Ignore" },
    ],
  },

  // ───────────────────────────────────────────────────────── 2. Heart Health ──
  {
    slug: 'why-your-lipid-profile-test-matters',
    category: 'Heart Health',
    icon: 'favorite',
    accent: '#EF4444',
    accentBg: '#FEF2F2',
    readingTime: '5 min read',
    title: 'Why Your Lipid Profile Test Matters',
    excerpt:
      'Cholesterol builds up silently in your arteries long before a heart attack. A simple lipid profile test reveals your risk early — here is what the numbers mean.',
    image: 'photo-1628348068343-c6a848d2b6dd',
    intro:
      'Heart disease is one of the leading causes of death worldwide, yet much of the risk is hidden and preventable. A lipid profile is a simple blood test that measures the fats (lipids) in your blood — chiefly cholesterol and triglycerides. These numbers tell you, years in advance, how likely you are to develop clogged arteries. Understanding them puts you back in control of your heart health.',
    sections: [
      {
        heading: 'What a lipid profile actually measures',
        body:
          'A lipid profile is usually a single blood draw that reports four key values. Together they paint a picture of how fat is moving through your bloodstream and how much is at risk of sticking to your artery walls.',
        points: [
          'Total cholesterol — the overall amount of cholesterol in your blood',
          'LDL ("bad") cholesterol — the type that clogs arteries',
          'HDL ("good") cholesterol — the type that clears fat away',
          'Triglycerides — a fat linked to diet, weight and diabetes',
        ],
      },
      {
        heading: 'Good vs bad cholesterol',
        body:
          'Not all cholesterol is harmful. LDL cholesterol carries fat into your arteries, where it can build up into plaques that narrow the vessel. HDL cholesterol does the opposite — it carries fat back to the liver to be removed. That is why you want your LDL low and your HDL high. Think of HDL as the clean-up crew and LDL as the litter.',
        image: 'photo-1559757175-0eb30cd8c063',
        imageAlt: 'Doctor reviewing heart health report',
      },
      {
        heading: 'How it helps prevent a heart attack',
        body:
          'Plaque builds up in the arteries for years without any symptoms. If a plaque bursts, it can block blood flow to the heart and cause a heart attack, or to the brain and cause a stroke. Because you cannot feel high cholesterol, the only way to catch it is to test. Knowing your LDL early means you can lower it with diet, exercise or medication long before a crisis.',
      },
      {
        heading: 'When should you get tested?',
        body:
          'Most adults should check their lipids regularly, and more often if they carry extra risk. Talk to a doctor sooner if any of these apply to you.',
        points: [
          'Every adult from around age 20, then repeated as advised',
          'Sooner if you have a family history of heart disease',
          'If you have diabetes, high blood pressure or are overweight',
          'If you smoke or lead a mostly inactive lifestyle',
        ],
      },
    ],
    keyTakeaways: [
      'A lipid profile reveals heart-attack risk years before symptoms appear.',
      'Keep LDL ("bad") cholesterol low and HDL ("good") cholesterol high.',
      'High cholesterol has no symptoms — testing is the only way to know.',
      'Early results let you act with diet, exercise or medication in time.',
    ],
    conclusion:
      'Your heart works every second of your life without complaint — a lipid profile is a small way to look after it. The test is quick, needs only a short fast, and can be collected at home. If you have never checked your cholesterol, now is a good time to start.',
    videos: [
      { id: 'okd4-2XmpeA', title: 'What is the Lipid Profile Test: A Doctor Explains' },
      { id: 'LrnZ4FoE71Y', title: 'Why is the Lipid Profile Test Important?' },
    ],
  },

  // ──────────────────────────────────────────────────────── 3. Thyroid Health ──
  {
    slug: 'common-signs-of-thyroid-disorders',
    category: 'Thyroid Health',
    icon: 'monitor_heart',
    accent: '#00B4AE',
    accentBg: '#E6F9F8',
    readingTime: '4 min read',
    title: 'Common Signs of Thyroid Disorders',
    excerpt:
      'The thyroid is a tiny gland with a huge job. When it slows down or speeds up, the symptoms are easy to miss. Here is how to spot a thyroid problem early.',
    image: 'photo-1631217868264-e5b90bb7e133',
    intro:
      'Your thyroid is a small, butterfly-shaped gland in the front of your neck. It produces hormones that control your metabolism — the speed at which your body uses energy. When it makes too little hormone (hypothyroidism) or too much (hyperthyroidism), nearly every part of the body is affected. Because the symptoms come on slowly and look like everyday complaints, thyroid disorders are often missed for years.',
    sections: [
      {
        heading: 'Weight changes',
        body:
          'An underactive thyroid slows metabolism, so weight can creep up even without eating more. An overactive thyroid does the reverse, causing unexplained weight loss despite a normal or increased appetite. Sudden, unexplained changes in weight deserve a closer look.',
      },
      {
        heading: 'Hair loss and skin changes',
        body:
          'Thyroid hormones help maintain healthy hair and skin. When levels are off, hair may thin or fall out and skin can become unusually dry, coarse or itchy. Some people also notice their eyebrows thinning at the outer edge.',
        image: 'photo-1666214280557-f1b5022eb634',
        imageAlt: 'Doctor examining a patient',
      },
      {
        heading: 'Fatigue and mood changes',
        body:
          'Low thyroid hormone leaves people feeling tired, sluggish and low in mood, even after a full night of sleep. An overactive thyroid can cause the opposite — restlessness, anxiety, a racing heart and trouble sleeping.',
      },
      {
        heading: 'Neck swelling',
        body:
          'Sometimes the thyroid itself enlarges, causing a visible swelling at the base of the neck known as a goitre. You may notice it when you swallow, or feel a tightness or lump in the throat. Any persistent neck swelling should be examined by a doctor.',
      },
      {
        heading: 'Why thyroid testing matters',
        body:
          'A simple blood test can measure your thyroid hormones and settle the question quickly. Thyroid disorders are very treatable — usually with a daily tablet — but only once they are found. Testing is especially worthwhile for women, who are far more likely to be affected.',
        points: [
          'TSH — the main screening test for thyroid function',
          'T3 and T4 — the actual thyroid hormones in your blood',
          'A full thyroid profile needs just one small blood sample',
        ],
      },
    ],
    keyTakeaways: [
      'The thyroid controls metabolism, so its problems affect the whole body.',
      'Watch for unexplained weight change, hair loss, fatigue and neck swelling.',
      'Symptoms build slowly and are easily mistaken for stress or ageing.',
      'A simple TSH blood test detects most thyroid disorders early.',
    ],
    conclusion:
      'Thyroid problems are common, easily tested and highly treatable. If you have been feeling persistently tired, noticed changes in your weight or hair, or spotted swelling in your neck, a quick thyroid profile can give you answers. Left untreated a thyroid disorder can affect your heart and energy for years — so testing is well worth it.',
    videos: [
      { id: 'Hzh469R_uKs', title: 'Hypothyroidism Explained: 10 Symptoms to Know' },
      { id: 'haohK5nzT2g', title: 'Hypothyroidism Explained Clearly' },
    ],
  },

  // ──────────────────────────────────────────────────────── 4. Women's Health ──
  {
    slug: 'vitamin-deficiencies-every-woman-should-know',
    category: "Women's Health",
    icon: 'female',
    accent: '#DB2777',
    accentBg: '#FCE7F3',
    readingTime: '5 min read',
    title: 'Vitamin Deficiencies Every Woman Should Know About',
    excerpt:
      'Fatigue, hair fall and low mood are often blamed on a busy life — but they can signal a vitamin deficiency. Here are the ones women should watch most closely.',
    image: 'photo-1571019613454-1cb2f99b2d8b',
    intro:
      "Women have unique nutritional needs that change through menstruation, pregnancy, breastfeeding and menopause. Because of these extra demands, certain vitamin and mineral deficiencies are far more common in women — and their symptoms, like tiredness and hair fall, are easy to shrug off. Knowing which nutrients to watch, and testing for them, can restore energy and protect long-term health.",
    sections: [
      {
        heading: 'Vitamin D',
        body:
          'Vitamin D helps your body absorb calcium and keeps bones, muscles and the immune system strong. Many women are low in it because of limited sun exposure and indoor lifestyles. Deficiency can cause bone pain, muscle weakness, low mood and frequent illness.',
        image: 'photo-1594007654729-407eedc4be65',
        imageAlt: 'Sunlight for vitamin D',
      },
      {
        heading: 'Vitamin B12',
        body:
          'B12 keeps your nerves and blood cells healthy and is essential for energy. It is found mainly in animal foods, so vegetarians and vegans are especially at risk. Low B12 can cause tiredness, tingling in the hands and feet, memory fog and a sore tongue.',
      },
      {
        heading: 'Iron',
        body:
          'Iron carries oxygen around the body. Because women lose blood every month during their periods, iron deficiency (and the anaemia it causes) is very common. Signs include fatigue, pale skin, breathlessness, dizziness and brittle nails.',
      },
      {
        heading: 'Calcium',
        body:
          'Calcium builds and maintains strong bones and teeth. Women lose bone density faster after menopause, so a lifelong calcium habit matters. Long-term shortage raises the risk of osteoporosis, where bones become fragile and break easily.',
      },
      {
        heading: 'Recommended health checkups',
        body:
          'Most of these deficiencies are simple to detect with a blood test and easy to correct with diet or supplements. A women’s wellness panel bundles the key markers together so you get a full picture in one visit.',
        points: [
          'Vitamin D (25-OH) level',
          'Vitamin B12 level',
          'Complete Blood Count and iron studies for anaemia',
          'Calcium and, where relevant, a thyroid and hormone panel',
        ],
      },
    ],
    keyTakeaways: [
      "Women's changing life stages make certain deficiencies far more likely.",
      'Vitamin D, B12, iron and calcium are the four to watch most closely.',
      'Everyday tiredness and hair fall can be the first signs of a shortage.',
      'A simple blood panel finds these deficiencies so they can be corrected.',
    ],
    conclusion:
      'You do not have to accept constant tiredness as normal. If low energy, hair fall or frequent illness are wearing you down, a women’s wellness blood panel can reveal whether a vitamin or mineral deficiency is to blame — and most are quickly and cheaply corrected. Looking after these basics is one of the best investments you can make in your long-term health.',
    videos: [
      { id: 'S6ZSLMKc9DY', title: '8 Essential Vitamins and Minerals for Women' },
      { id: 'K4CRx3loO2w', title: 'Top Vitamins Women Should Take Daily' },
    ],
  },

  // ─────────────────────────────────────────────────── 5. Full Body Checkup ──
  {
    slug: 'why-annual-health-checkups-can-save-lives',
    category: 'Full Body Checkup',
    icon: 'health_and_safety',
    accent: '#0047CC',
    accentBg: '#EEF4FF',
    readingTime: '4 min read',
    title: 'Why Annual Health Checkups Can Save Lives',
    excerpt:
      'Most serious diseases are silent in their early stages. A yearly health checkup finds problems while they are still easy to treat — often before you feel a thing.',
    image: 'photo-1579684385127-1ef15d508118',
    intro:
      'It is easy to skip a health checkup when you feel perfectly fine. But many of the most serious conditions — diabetes, high blood pressure, high cholesterol, even some cancers — cause no symptoms at all in their early stages. An annual health checkup is a simple, low-cost way to catch these hidden problems while they are still easy to treat. Think of it as regular servicing for your body.',
    sections: [
      {
        heading: 'Early disease detection',
        body:
          'A yearly checkup screens for conditions that develop silently. Finding a rising blood sugar or blood pressure early — before it damages your organs — means you can often reverse or control it with simple lifestyle changes rather than lifelong medication.',
        image: 'photo-1584982751601-97dcc096659c',
        imageAlt: 'Doctor with a patient during a checkup',
      },
      {
        heading: 'Preventive healthcare beats cure',
        body:
          'Prevention is almost always cheaper, easier and safer than treatment. Catching a problem in its early stage usually means a small change now, instead of a hospital stay later. Regular checkups also give you a baseline, so your doctor can spot changes from year to year.',
      },
      {
        heading: 'What regular blood tests reveal',
        body:
          'A good full-body package looks across all the major systems in one visit, giving a broad snapshot of your health.',
        points: [
          'Blood sugar and HbA1c for diabetes',
          'Lipid profile for heart-disease risk',
          'Liver and kidney function tests',
          'Complete blood count, thyroid and vitamin levels',
        ],
      },
      {
        heading: 'Recommended yearly screenings',
        body:
          'How often and what to test for depends on your age, sex and family history. As a general guide, most healthy adults benefit from a yearly review, while those with risk factors may need more frequent monitoring. Your doctor can tailor the package to you.',
      },
    ],
    keyTakeaways: [
      'Serious diseases are often silent in their early, most treatable stage.',
      'A yearly checkup catches hidden problems before they cause harm.',
      'Prevention is cheaper, safer and easier than treating advanced disease.',
      'Regular tests build a baseline so changes are spotted year to year.',
    ],
    conclusion:
      'Feeling well is wonderful — but it is not proof that everything is fine beneath the surface. An annual health checkup gives you real reassurance, or an early warning while there is still time to act. Booking one for yourself and your family is one of the simplest, most powerful things you can do for your future.',
    videos: [
      { id: '_4-FwfydjnE', title: 'The Importance of Regular Health Screenings for Disease Prevention' },
    ],
  },

  // ───────────────────────────────────────────────────────── 6. Blood Pressure ──
  {
    slug: 'high-blood-pressure-the-silent-killer',
    category: 'Blood Pressure',
    icon: 'vital_signs',
    accent: '#F59E0B',
    accentBg: '#FEF3C7',
    readingTime: '4 min read',
    title: 'High Blood Pressure: The Silent Killer',
    excerpt:
      'High blood pressure rarely causes symptoms, yet it quietly damages the heart, brain and kidneys. Learn the risk factors and how simple monitoring can protect you.',
    image: 'photo-1615461066841-6116e61058f4',
    intro:
      'High blood pressure, or hypertension, is often called "the silent killer" — and for good reason. It usually causes no symptoms at all, yet for years it can quietly damage your heart, brain, kidneys and eyes. Because you cannot feel it, the only way to know is to measure it. The reassuring news is that once found, high blood pressure is very manageable with lifestyle changes and, when needed, simple medication.',
    sections: [
      {
        heading: 'Symptoms (or the lack of them)',
        body:
          'Most people with high blood pressure feel completely normal, which is exactly what makes it dangerous. When symptoms do appear — headaches, dizziness, blurred vision or nosebleeds — pressure is often already very high. Never wait for symptoms; rely on regular measurement instead.',
      },
      {
        heading: 'Risk factors',
        body:
          'Some things raise your risk of high blood pressure. Knowing yours helps you and your doctor stay watchful.',
        points: [
          'A family history of high blood pressure',
          'Being overweight or physically inactive',
          'A diet high in salt and processed food',
          'Smoking, excess alcohol and ongoing stress',
        ],
        image: 'photo-1584515933487-779824d29309',
        imageAlt: 'Blood pressure monitor on a table',
      },
      {
        heading: 'Prevention and lifestyle changes',
        body:
          'The habits that prevent high blood pressure are the same ones that help control it. Small, steady changes make a real difference over time.',
        points: [
          'Cut back on salt and eat more fruit and vegetables',
          'Stay active — aim for regular brisk walking',
          'Maintain a healthy weight and limit alcohol',
          'Stop smoking and find ways to manage stress',
        ],
      },
      {
        heading: 'The importance of regular monitoring',
        body:
          'Because high blood pressure is invisible, regular checks are your best defence. A quick reading at home or during a checkup takes seconds and could add years to your life. If your readings are high, a doctor can confirm the diagnosis and guide you on next steps.',
      },
    ],
    keyTakeaways: [
      'High blood pressure usually has no symptoms — you cannot feel it.',
      'Left unchecked it silently damages the heart, brain and kidneys.',
      'Diet, exercise, weight and lifestyle strongly influence your numbers.',
      'Regular monitoring is the only reliable way to catch it in time.',
    ],
    conclusion:
      'You would not drive a car with the fuel gauge hidden — yet many people go years without knowing their blood pressure. A reading takes only seconds and could prevent a stroke or heart attack. Make regular blood-pressure checks a normal part of looking after yourself.',
    videos: [
      { id: 'OFh9n3oC9ig', title: 'High Blood Pressure: Why Doctors Call It the Silent Killer' },
      { id: 'GUyOplgdQeA', title: 'High Blood Pressure: The Silent Killer' },
    ],
  },

  // ─────────────────────────────────────────────────────────── 7. Liver Health ──
  {
    slug: 'how-to-keep-your-liver-healthy',
    category: 'Liver Health',
    icon: 'science',
    accent: '#10B981',
    accentBg: '#ECFDF5',
    readingTime: '4 min read',
    title: 'How to Keep Your Liver Healthy',
    excerpt:
      'Your liver quietly performs hundreds of jobs to keep you alive. These everyday habits protect it — and a simple test can tell you how well it is working.',
    image: 'photo-1512621776951-a57141f2eefd',
    intro:
      'The liver is one of the hardest-working organs in your body. It filters toxins from your blood, helps digest food, stores energy and makes proteins you need to survive. Yet it rarely complains until damage is well advanced. The good news is that the liver is remarkably resilient, and a few sensible habits go a long way toward keeping it healthy for life.',
    sections: [
      {
        heading: 'Eat a healthy, balanced diet',
        body:
          'What you eat directly affects your liver. A diet rich in vegetables, fruit, whole grains and lean protein supports it, while too much sugar, fried food and processed snacks can lead to fat building up inside the liver. Staying well hydrated also helps it do its job.',
        image: 'photo-1490645935967-10de6ba17061',
        imageAlt: 'Healthy balanced meal of fruit and vegetables',
      },
      {
        heading: 'Stay physically active',
        body:
          'Regular exercise helps burn the fat that can otherwise accumulate in the liver, and it keeps your weight in a healthy range. Even brisk walking most days of the week reduces the risk of fatty liver disease, one of the most common liver problems today.',
      },
      {
        heading: 'Avoid excessive alcohol',
        body:
          'Alcohol is broken down by the liver, and drinking heavily over time can scar it permanently. Keeping alcohol within safe limits — or avoiding it altogether — is one of the single most protective things you can do for your liver.',
      },
      {
        heading: 'Know your Liver Function Tests (LFT)',
        body:
          'A Liver Function Test is a simple blood test that measures enzymes and proteins to show how well your liver is working. Because liver damage is often silent, an LFT can reveal a problem early, while it is still easy to reverse.',
        points: [
          'Measures liver enzymes such as ALT and AST',
          'Checks bilirubin and protein levels',
          'Helps detect fatty liver, hepatitis and other issues early',
        ],
      },
    ],
    keyTakeaways: [
      'The liver performs hundreds of vital jobs but rarely signals early damage.',
      'A balanced diet and regular exercise prevent fat building up in the liver.',
      'Limiting alcohol is one of the most protective choices you can make.',
      'A simple Liver Function Test reveals problems while they are reversible.',
    ],
    conclusion:
      'Your liver looks after you around the clock, so it is worth looking after in return. Eating well, staying active and moderating alcohol keep it in good shape, while an occasional Liver Function Test gives you peace of mind. Small daily choices add up to a healthy liver for years to come.',
    videos: [
      { id: 'eHqCrul4Jlg', title: 'Dietary Tips to Keep Your Liver Healthy' },
      { id: '-bHg_W9FY2E', title: '7 Ways to Keep Your Liver Healthy' },
    ],
  },

  // ────────────────────────────────────────────────────────── 8. Kidney Health ──
  {
    slug: 'protect-your-kidneys-before-problems-begin',
    category: 'Kidney Health',
    icon: 'invert_colors',
    accent: '#0EA5E9',
    accentBg: '#E0F2FE',
    readingTime: '4 min read',
    title: 'Protect Your Kidneys Before Problems Begin',
    excerpt:
      'Kidney disease can advance for years without warning. Simple daily habits and a routine test help you protect these vital filters before problems begin.',
    image: 'photo-1559839734-2b71ea197ec2',
    intro:
      'Your kidneys are two bean-shaped organs that filter waste and extra fluid from your blood, balance minerals and help control blood pressure. They are essential to life, yet kidney disease often develops silently — a person can lose a large share of kidney function before noticing anything is wrong. Protecting your kidneys is mostly about a few sensible daily habits and testing when you have risk factors.',
    sections: [
      {
        heading: 'Stay well hydrated',
        body:
          'Water helps your kidneys clear sodium and toxins from the body. Drinking enough fluid through the day supports healthy filtering and lowers the risk of kidney stones. In most cases plain water is the best choice — sugary and fizzy drinks add strain rather than help.',
        image: 'photo-1523362628745-0c100150b504',
        imageAlt: 'Person drinking a glass of water',
      },
      {
        heading: 'Control diabetes and blood pressure',
        body:
          'The two biggest causes of kidney damage are diabetes and high blood pressure. Both harm the tiny blood vessels inside the kidneys over time. Keeping your blood sugar and blood pressure within a healthy range is the most important thing you can do to protect them.',
      },
      {
        heading: 'Know your Kidney Function Tests (KFT)',
        body:
          'A Kidney Function Test is a simple blood and urine test that shows how well your kidneys are filtering. Because early kidney disease has no symptoms, testing is the only way to catch it in time — especially if you have diabetes or high blood pressure.',
        points: [
          'Blood creatinine and eGFR to measure filtering ability',
          'Blood urea to check waste removal',
          'Urine tests for protein, an early sign of kidney stress',
        ],
      },
      {
        heading: 'Watch for warning signs',
        body:
          'While early kidney disease is usually silent, more advanced problems can show subtle signs. Report any of these to a doctor, particularly if you are at higher risk.',
        points: [
          'Swelling in the feet, ankles or around the eyes',
          'Foamy urine, or a change in how often you urinate',
          'Persistent tiredness, poor appetite or trouble sleeping',
          'High blood pressure that is hard to control',
        ],
      },
    ],
    keyTakeaways: [
      'Kidney disease can advance silently before any symptoms appear.',
      'Good hydration supports filtering and helps prevent kidney stones.',
      'Controlling diabetes and blood pressure is the key to healthy kidneys.',
      'A simple Kidney Function Test catches problems early, when they matter most.',
    ],
    conclusion:
      'Your kidneys work quietly every minute of every day, so it is easy to take them for granted. Staying hydrated, keeping diabetes and blood pressure in check, and having a Kidney Function Test when you are at risk are simple steps that protect them for the long run. A little care now prevents big problems later.',
    videos: [
      { id: 'YS5uxs_cDjM', title: 'Six Tips for Better Kidney Health' },
      { id: '4AJn0VB-mfs', title: 'How You Can Protect Your Kidneys' },
    ],
  },
];

/** Look up a single article by its slug. */
export function findArticle(slug: string): HealthArticle | undefined {
  return HEALTH_ARTICLES.find((a) => a.slug === slug);
}
