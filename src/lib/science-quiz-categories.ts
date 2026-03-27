export const SCIENCE_QUIZ_CATEGORIES = [
  "matma",
  "geografia",
  "nauka",
  "wiedza-ogolna",
] as const;

export type ScienceQuizCategory = (typeof SCIENCE_QUIZ_CATEGORIES)[number];

export const SCIENCE_QUIZ_CATEGORY_LABELS: Record<ScienceQuizCategory, string> = {
  matma: "Matematyka",
  geografia: "Geografia",
  nauka: "Nauka",
  "wiedza-ogolna": "Wiedza ogólna",
};

export function normalizeScienceQuizCategory(
  value: string | null | undefined,
): ScienceQuizCategory {
  if (value && SCIENCE_QUIZ_CATEGORIES.includes(value as ScienceQuizCategory)) {
    return value as ScienceQuizCategory;
  }

  return "matma";
}
