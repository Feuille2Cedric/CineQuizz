export function normalizeText(input) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isCorrectAnswer(input, acceptedAnswers) {
  const normalizedInput = normalizeText(input);

  if (!normalizedInput) {
    return false;
  }

  return acceptedAnswers.some((answer) => normalizeText(answer) === normalizedInput);
}
