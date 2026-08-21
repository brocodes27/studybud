const DISTRESS_PATTERN =
  /\b(can't do this|give up|too hard|depressed|failing everything|i quit|burn(?:ed|t) out|overwhelmed)\b/i;

const LEARNING_PATTERN_REVIEW =
  /\b(analy[sz]e|review|diagnose|understand)\b.{0,50}\b(my\s+)?(learning|study|performance|progress|habits?|patterns?)\b/i;

const MULTI_STAGE_TUTORING =
  /\b(compare|contrast|connect|relate|analy[sz]e|evaluate|explain|teach|review)\b.{0,180}\b(then|and then|after(?:wards| that)?|follow(?:ed)? by)\b.{0,100}\b(quiz|test|practice|practise|plan|questions?|examples?)\b/i;

export function shouldUseFullAtlasOrchestration(message: string) {
  const normalized = message.trim();
  if (!normalized) return false;
  if (DISTRESS_PATTERN.test(normalized)) return true;
  if (LEARNING_PATTERN_REVIEW.test(normalized)) return true;
  if (MULTI_STAGE_TUTORING.test(normalized)) return true;

  const questionCount = (normalized.match(/\?/g) || []).length;
  return normalized.length > 450 && questionCount >= 2;
}
