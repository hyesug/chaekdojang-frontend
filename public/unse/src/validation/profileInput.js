import { lunarToSolar } from '../core/lunar.js';

/** 사례 파일의 음력 생일을 엔진이 받는 양력 입력으로만 정규화한다. */
export function normalizeProfile(profile) {
  if (profile.calendar !== 'lunar') return profile;
  const solar = lunarToSolar(profile.year, profile.month, profile.day, profile.isLeap ?? false);
  const { calendar, isLeap, ...rest } = profile;
  return { ...rest, ...solar };
}
