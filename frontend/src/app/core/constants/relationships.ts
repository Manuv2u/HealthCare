/**
 * The one list of family relationships.
 *
 * The profile form and the booking flow used to declare their own lists with
 * different casing ("Sibling" vs "sibling"), and the backend accepted either.
 * Editing a member created by the other form then showed an empty dropdown,
 * because the stored value matched no <option>. Values are stored lowercase;
 * labels are what users see.
 */
export const RELATIONSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'other', label: 'Other' },
];

const VALUES = new Set(RELATIONSHIP_OPTIONS.map((o) => o.value));

/**
 * Coerce a stored value onto the canonical list so legacy rows (e.g. "Sibling")
 * still select correctly. Returns '' when there's no match, which leaves the
 * required-field validation to prompt for a real choice.
 */
export function normalizeRelationship(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.trim().toLowerCase();
  return VALUES.has(v) ? v : '';
}

/** Display label for a stored value; falls back to the raw value. */
export function relationshipLabel(value: string | null | undefined): string {
  const v = normalizeRelationship(value);
  return RELATIONSHIP_OPTIONS.find((o) => o.value === v)?.label ?? (value ?? '');
}
