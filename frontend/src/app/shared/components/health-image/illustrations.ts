/**
 * SRI HEALTH PLUS — HEALTHCARE ILLUSTRATION REGISTRY
 * ---------------------------------------------------
 * Self-contained, on-brand (single-accent teal) vector illustrations used across
 * the app in place of stock photography. Each entry is referenced ONLY by its
 * semantic `name` via <app-health-image name="..."> so the underlying asset can
 * change without touching any consumer template.
 *
 * ── HOW TO SWAP FOR REAL (AI-generated / photographic) IMAGES LATER ──────────
 * 1. Drop the photo in `src/assets/illustrations/` (e.g. `lab-hero.webp`).
 * 2. Change that entry below from:  { kind: 'svg', svg: `...` }
 *    to:                            { kind: 'photo', src: 'assets/illustrations/lab-hero.webp' }
 * 3. Done. Every page using <app-health-image name="lab-hero"> updates automatically —
 *    no layout or component changes required. Keep the same aspect ratio for a clean swap.
 *
 * Visual language: flat duotone teal on a soft rounded panel, consistent stroke
 * weight, slate ink for detail. viewBox 0 0 400 300 (scene) or 0 0 240 240 (spot).
 */

export type IllustrationName =
  | 'lab-hero'
  | 'sample-collection'
  | 'home-collection'
  | 'doctor'
  | 'patient'
  | 'technician'
  | 'diagnostic-equipment'
  | 'medical-report'
  | 'preventive-care'
  | 'family-health'
  | 'health-package'
  | 'blood-test'
  | 'digital-health'
  | 'empty-bookings'
  | 'empty-reports'
  | 'empty-search'
  | 'empty-generic';

export interface IllustrationAsset {
  /** 'svg' = inline vector (current); 'photo' = <img src> (future swap). */
  kind: 'svg' | 'photo';
  /** Inline SVG markup when kind === 'svg'. */
  svg?: string;
  /** Optional light-on-transparent variant for placement on dark backgrounds (tone="dark"). */
  svgDark?: string;
  /** Asset path when kind === 'photo', e.g. 'assets/illustrations/lab-hero.webp'. */
  src?: string;
  /** Natural aspect ratio (w/h) so the frame reserves space and swaps cleanly. */
  ratio: number;
}

// ── shared palette (teal ramp + slate ink) ─────────────────────────────────
const C = {
  d900: '#001B57', d800: '#001B57', d700: '#002577', d600: '#003399',
  t500: '#0047CC', t400: '#0A50D8', t300: '#84A6FF', t200: '#B3CAFF',
  t100: '#D9E5FF', t50: '#EEF4FF', ink: '#0F172A', ink2: '#475569',
  line: '#CBD5E1', paper: '#FFFFFF', red: '#EF4444', amber: '#F59E0B',
};

/** Soft rounded backdrop panel shared by scene illustrations. */
const panel = (fill = C.t50) =>
  `<rect x="4" y="4" width="392" height="292" rx="24" fill="${fill}"/>`;

// ── scene illustrations (400 x 300) ─────────────────────────────────────────

const labHero = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="315" cy="70" r="42" fill="${C.t100}"/>
  <path d="M60 250h280" stroke="${C.t200}" stroke-width="4" stroke-linecap="round"/>
  <!-- microscope -->
  <rect x="150" y="120" width="26" height="96" rx="8" fill="${C.t500}"/>
  <rect x="120" y="212" width="120" height="18" rx="9" fill="${C.d700}"/>
  <path d="M176 132c40 0 58 26 58 58" stroke="${C.d600}" stroke-width="10" stroke-linecap="round"/>
  <rect x="150" y="96" width="26" height="34" rx="8" fill="${C.d700}"/>
  <circle cx="163" cy="86" r="12" fill="${C.t300}"/>
  <rect x="150" y="196" width="60" height="12" rx="6" fill="${C.d600}"/>
  <!-- test tubes -->
  <rect x="250" y="150" width="20" height="70" rx="10" fill="${C.paper}" stroke="${C.t400}" stroke-width="4"/>
  <rect x="250" y="188" width="20" height="32" rx="0" fill="${C.t400}"/>
  <rect x="280" y="140" width="20" height="80" rx="10" fill="${C.paper}" stroke="${C.t400}" stroke-width="4"/>
  <rect x="280" y="184" width="20" height="36" rx="0" fill="${C.t300}"/>
  <!-- drop -->
  <path d="M315 40c8 12 14 20 14 28a14 14 0 11-28 0c0-8 6-16 14-28z" fill="${C.t500}"/>
</svg>`;

const sampleCollection = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="90" cy="90" r="46" fill="${C.t100}"/>
  <!-- forearm -->
  <rect x="70" y="150" width="200" height="46" rx="23" fill="${C.t200}"/>
  <!-- syringe / vacutainer -->
  <rect x="196" y="96" width="120" height="26" rx="13" fill="${C.paper}" stroke="${C.t500}" stroke-width="4" transform="rotate(28 196 96)"/>
  <rect x="205" y="112" width="52" height="26" rx="4" fill="${C.t400}" transform="rotate(28 205 112)"/>
  <path d="M150 168l22 12" stroke="${C.d700}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="150" cy="173" r="9" fill="${C.red}"/>
  <!-- plaster -->
  <rect x="128" y="160" width="34" height="22" rx="6" fill="${C.t50}" stroke="${C.t400}" stroke-width="3"/>
</svg>`;

const homeCollection = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <!-- house -->
  <path d="M90 150l90-64 90 64" stroke="${C.t500}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="112" y="150" width="136" height="96" rx="10" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <rect x="150" y="188" width="34" height="58" rx="4" fill="${C.t200}"/>
  <rect x="196" y="176" width="34" height="30" rx="4" fill="${C.t100}"/>
  <!-- medical bag -->
  <rect x="256" y="196" width="86" height="60" rx="12" fill="${C.t500}"/>
  <rect x="284" y="182" width="30" height="18" rx="6" fill="${C.d700}"/>
  <path d="M299 214v22M288 225h22" stroke="${C.paper}" stroke-width="6" stroke-linecap="round"/>
  <!-- heart -->
  <path d="M180 60c10-14 34-10 34 8 0 14-20 24-34 34-14-10-34-20-34-34 0-18 24-22 34-8z" fill="${C.t300}"/>
</svg>`;

const doctor = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="200" cy="112" r="52" fill="${C.t100}"/>
  <circle cx="200" cy="104" r="34" fill="${C.t300}"/>
  <path d="M120 256c0-46 36-74 80-74s80 28 80 74z" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <path d="M172 190v34a28 28 0 0056 0v-34" stroke="${C.t500}" stroke-width="6"/>
  <circle cx="200" cy="240" r="12" fill="${C.t500}"/>
  <!-- stethoscope -->
  <path d="M176 182c-6 40 12 58 24 58s30-18 24-58" stroke="${C.d600}" stroke-width="5" fill="none"/>
  <circle cx="176" cy="180" r="6" fill="${C.d600}"/>
  <circle cx="224" cy="180" r="6" fill="${C.d600}"/>
</svg>`;

const patient = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="200" cy="110" r="46" fill="${C.t200}"/>
  <circle cx="200" cy="104" r="30" fill="${C.t400}"/>
  <path d="M132 254c0-42 30-68 68-68s68 26 68 68z" fill="${C.t100}"/>
  <path d="M168 254v-40h64v40" stroke="${C.t500}" stroke-width="6" fill="none"/>
  <!-- smile / wellbeing check -->
  <path d="M186 108c4 5 24 5 28 0" stroke="${C.d700}" stroke-width="4" stroke-linecap="round"/>
  <path d="M300 96l14 14 26-28" stroke="${C.t500}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const technician = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="200" cy="106" r="46" fill="${C.t100}"/>
  <circle cx="200" cy="100" r="30" fill="${C.t300}"/>
  <path d="M132 256c0-42 30-70 68-70s68 28 68 70z" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <!-- gloves holding tube -->
  <rect x="238" y="150" width="18" height="70" rx="9" fill="${C.paper}" stroke="${C.t500}" stroke-width="4" transform="rotate(18 238 150)"/>
  <rect x="243" y="182" width="18" height="34" fill="${C.t400}" transform="rotate(18 243 182)"/>
  <!-- id badge -->
  <rect x="176" y="196" width="26" height="34" rx="5" fill="${C.t500}"/>
  <path d="M180 152l14 14 24-26" stroke="${C.d700}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
</svg>`;

const diagnosticEquipment = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <rect x="96" y="80" width="208" height="150" rx="16" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <rect x="120" y="104" width="160" height="70" rx="8" fill="${C.d800}"/>
  <path d="M132 140h26l10-22 16 44 12-30 10 8h44" stroke="${C.t300}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="140" cy="200" r="8" fill="${C.t500}"/>
  <rect x="164" y="194" width="120" height="12" rx="6" fill="${C.t100}"/>
  <rect x="150" y="230" width="100" height="16" rx="8" fill="${C.t200}"/>
</svg>`;

const medicalReport = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <rect x="128" y="56" width="160" height="196" rx="14" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <circle cx="208" cy="96" r="22" fill="${C.t100}"/>
  <path d="M198 96l7 7 13-15" stroke="${C.t500}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="152" y="134" width="112" height="10" rx="5" fill="${C.t200}"/>
  <rect x="152" y="156" width="88" height="10" rx="5" fill="${C.line}"/>
  <rect x="152" y="184" width="112" height="10" rx="5" fill="${C.t200}"/>
  <rect x="152" y="206" width="72" height="10" rx="5" fill="${C.line}"/>
  <!-- heartbeat strip -->
  <path d="M300 200h-14l-8-18-12 34-8-16h-10" stroke="${C.t500}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
</svg>`;

const preventiveCare = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <path d="M200 250c-70-40-96-82-96-124a52 52 0 01100-20 52 52 0 01100 20c0 42-34 84-104 124z" fill="${C.t100}" stroke="${C.t400}" stroke-width="6"/>
  <path d="M158 150h26l14-30 22 60 14-30h20" stroke="${C.t500}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const familyHealth = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <circle cx="150" cy="120" r="34" fill="${C.t300}"/>
  <path d="M104 236c0-32 20-52 46-52s46 20 46 52z" fill="${C.t200}"/>
  <circle cx="250" cy="120" r="34" fill="${C.t400}"/>
  <path d="M204 236c0-32 20-52 46-52s46 20 46 52z" fill="${C.t100}"/>
  <circle cx="200" cy="170" r="22" fill="${C.t500}"/>
  <path d="M170 244c0-20 14-32 30-32s30 12 30 32z" fill="${C.d600}"/>
  <path d="M200 70c6-9 22-6 22 5 0 9-13 15-22 22-9-7-22-13-22-22 0-11 16-14 22-5z" fill="${C.paper}"/>
</svg>`;

const healthPackage = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <path d="M110 120l90-40 90 40-90 40z" fill="${C.t300}"/>
  <path d="M110 120v90l90 40v-90z" fill="${C.t500}"/>
  <path d="M290 120v90l-90 40v-90z" fill="${C.d600}"/>
  <path d="M155 100l90 40" stroke="${C.paper}" stroke-width="5" stroke-linecap="round"/>
  <path d="M200 160v40" stroke="${C.paper}" stroke-width="4" opacity=".6"/>
  <path d="M300 78l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" fill="${C.t100}"/>
</svg>`;

const bloodTest = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <g>
    <rect x="150" y="70" width="34" height="150" rx="17" fill="${C.paper}" stroke="${C.t500}" stroke-width="5"/>
    <rect x="150" y="150" width="34" height="70" rx="0" fill="${C.red}"/>
    <rect x="146" y="60" width="42" height="18" rx="8" fill="${C.d700}"/>
  </g>
  <g>
    <rect x="216" y="90" width="34" height="130" rx="17" fill="${C.paper}" stroke="${C.t500}" stroke-width="5"/>
    <rect x="216" y="164" width="34" height="56" rx="0" fill="${C.t300}"/>
    <rect x="212" y="80" width="42" height="18" rx="8" fill="${C.d700}"/>
  </g>
  <circle cx="300" cy="90" r="8" fill="${C.red}"/>
  <path d="M100 236h200" stroke="${C.t200}" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const digitalHealth = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  ${panel(C.t50)}
  <rect x="150" y="56" width="100" height="188" rx="18" fill="${C.d800}"/>
  <rect x="160" y="74" width="80" height="152" rx="8" fill="${C.paper}"/>
  <path d="M170 150h14l8-16 12 34 10-24 8 6h16" stroke="${C.t500}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="170" y="92" width="60" height="10" rx="5" fill="${C.t200}"/>
  <rect x="170" y="188" width="60" height="10" rx="5" fill="${C.t100}"/>
  <circle cx="200" cy="236" r="6" fill="${C.t300}"/>
  <path d="M296 96c8 12 14 20 14 28a14 14 0 11-28 0c0-8 6-16 14-28z" fill="${C.t400}"/>
</svg>`;

// ── dark-tone hero variant (light-on-transparent, for dark hero bands) ──────

const labHeroDark = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="312" cy="72" r="46" fill="${C.t200}" opacity="0.14"/>
  <circle cx="86" cy="96" r="34" fill="${C.t200}" opacity="0.12"/>
  <path d="M60 252h280" stroke="${C.t200}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
  <!-- microscope -->
  <rect x="150" y="120" width="26" height="96" rx="8" fill="${C.t200}"/>
  <rect x="118" y="212" width="124" height="18" rx="9" fill="${C.t300}"/>
  <path d="M176 132c40 0 58 26 58 58" stroke="${C.t100}" stroke-width="10" stroke-linecap="round"/>
  <rect x="150" y="96" width="26" height="34" rx="8" fill="${C.t100}"/>
  <circle cx="163" cy="86" r="12" fill="${C.paper}"/>
  <rect x="150" y="196" width="60" height="12" rx="6" fill="${C.t300}"/>
  <!-- test tubes -->
  <rect x="250" y="150" width="20" height="70" rx="10" fill="none" stroke="${C.t100}" stroke-width="4"/>
  <rect x="250" y="188" width="20" height="30" rx="0" fill="${C.t200}"/>
  <rect x="280" y="140" width="20" height="80" rx="10" fill="none" stroke="${C.t100}" stroke-width="4"/>
  <rect x="280" y="184" width="20" height="34" rx="0" fill="${C.t300}"/>
  <!-- drop -->
  <path d="M312 42c8 12 14 20 14 28a14 14 0 11-28 0c0-8 6-16 14-28z" fill="${C.t100}"/>
  <!-- pulse -->
  <path d="M96 150h20l10-20 16 44 12-30 8 6h24" stroke="${C.t200}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
</svg>`;

const homeCollectionDark = `
<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="316" cy="70" r="44" fill="${C.t200}" opacity="0.14"/>
  <!-- house -->
  <path d="M90 150l90-64 90 64" stroke="${C.t100}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="112" y="150" width="136" height="96" rx="10" fill="none" stroke="${C.t100}" stroke-width="6"/>
  <rect x="150" y="188" width="34" height="58" rx="4" fill="${C.t300}"/>
  <rect x="196" y="176" width="34" height="30" rx="4" fill="${C.t200}"/>
  <!-- medical bag -->
  <rect x="256" y="196" width="86" height="60" rx="12" fill="${C.t200}"/>
  <rect x="284" y="182" width="30" height="18" rx="6" fill="${C.t100}"/>
  <path d="M299 214v22M288 225h22" stroke="${C.d800}" stroke-width="6" stroke-linecap="round"/>
  <!-- heart -->
  <path d="M180 60c10-14 34-10 34 8 0 14-20 24-34 34-14-10-34-20-34-34 0-18 24-22 34-8z" fill="${C.t100}"/>
</svg>`;

// ── empty-state spot art (240 x 240) ────────────────────────────────────────

const emptyBookings = `
<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="120" cy="120" r="96" fill="${C.t50}"/>
  <rect x="66" y="66" width="108" height="104" rx="14" fill="${C.paper}" stroke="${C.t400}" stroke-width="5"/>
  <rect x="66" y="66" width="108" height="26" rx="14" fill="${C.t300}"/>
  <path d="M88 60v14M152 60v14" stroke="${C.d700}" stroke-width="6" stroke-linecap="round"/>
  <path d="M104 128l12 12 24-26" stroke="${C.t500}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const emptyReports = `
<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="120" cy="120" r="96" fill="${C.t50}"/>
  <rect x="76" y="58" width="88" height="120" rx="12" fill="${C.paper}" stroke="${C.t400}" stroke-width="5"/>
  <rect x="94" y="86" width="52" height="8" rx="4" fill="${C.t200}"/>
  <rect x="94" y="104" width="40" height="8" rx="4" fill="${C.line}"/>
  <rect x="94" y="130" width="52" height="8" rx="4" fill="${C.t200}"/>
  <rect x="94" y="148" width="34" height="8" rx="4" fill="${C.line}"/>
</svg>`;

const emptySearch = `
<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="120" cy="120" r="96" fill="${C.t50}"/>
  <circle cx="110" cy="110" r="42" fill="${C.paper}" stroke="${C.t400}" stroke-width="6"/>
  <path d="M142 142l30 30" stroke="${C.t500}" stroke-width="10" stroke-linecap="round"/>
  <path d="M96 110h28M110 96v28" stroke="${C.t300}" stroke-width="6" stroke-linecap="round"/>
</svg>`;

const emptyGeneric = `
<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <circle cx="120" cy="120" r="96" fill="${C.t50}"/>
  <rect x="70" y="86" width="100" height="72" rx="14" fill="${C.paper}" stroke="${C.t400}" stroke-width="5"/>
  <path d="M70 118h34l10 16h12l10-16h34" stroke="${C.t300}" stroke-width="5" fill="none" stroke-linejoin="round"/>
  <circle cx="120" cy="122" r="10" fill="${C.t200}"/>
</svg>`;

// Registry = teal SVG illustrations (used for empty states & any name-based usage).
// Real photos are placement-UNIQUE and passed directly via <app-health-image src="…">
// so no image is ever reused across sections. Photos live in assets/photos/.
export const ILLUSTRATIONS: Record<IllustrationName, IllustrationAsset> = {
  'lab-hero': { kind: 'svg', svg: labHero, svgDark: labHeroDark, ratio: 400 / 300 },
  'sample-collection': { kind: 'svg', svg: sampleCollection, ratio: 400 / 300 },
  'home-collection': { kind: 'svg', svg: homeCollection, svgDark: homeCollectionDark, ratio: 400 / 300 },
  'doctor': { kind: 'svg', svg: doctor, ratio: 400 / 300 },
  'patient': { kind: 'svg', svg: patient, ratio: 400 / 300 },
  'technician': { kind: 'svg', svg: technician, ratio: 400 / 300 },
  'diagnostic-equipment': { kind: 'svg', svg: diagnosticEquipment, ratio: 400 / 300 },
  'medical-report': { kind: 'svg', svg: medicalReport, ratio: 400 / 300 },
  'preventive-care': { kind: 'svg', svg: preventiveCare, ratio: 400 / 300 },
  'family-health': { kind: 'svg', svg: familyHealth, ratio: 400 / 300 },
  'health-package': { kind: 'svg', svg: healthPackage, ratio: 400 / 300 },
  'blood-test': { kind: 'svg', svg: bloodTest, ratio: 400 / 300 },
  'digital-health': { kind: 'svg', svg: digitalHealth, ratio: 400 / 300 },
  'empty-bookings': { kind: 'svg', svg: emptyBookings, ratio: 1 },
  'empty-reports': { kind: 'svg', svg: emptyReports, ratio: 1 },
  'empty-search': { kind: 'svg', svg: emptySearch, ratio: 1 },
  'empty-generic': { kind: 'svg', svg: emptyGeneric, ratio: 1 },
};
