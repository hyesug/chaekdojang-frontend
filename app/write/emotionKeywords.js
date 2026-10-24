export const PRESET_EMOTIONS = ["성장", "혼란", "위로", "성찰", "흥미", "먹먹함", "기쁨", "분노"];

/** @param {string[]} selectedEmotions @returns {string[]} */
export function customEmotionKeywords(selectedEmotions) {
  return selectedEmotions.filter((keyword) => !PRESET_EMOTIONS.includes(keyword));
}
