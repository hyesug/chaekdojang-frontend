const countBy = (cases, key) => Object.fromEntries(cases.reduce((map, item) => {
  const value = item.profile?.[key];
  if (value != null) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}, new Map()));

export function assessCasebookBias(cases) {
  const total = cases.length;
  const byYear = countBy(cases, 'year');
  const byHomePlace = countBy(cases, 'homePlace');
  const warnings = [];
  for (const [year, n] of Object.entries(byYear)) if (n / total > 0.5) warnings.push(`출생연도 ${year} 사례가 ${n}/${total}명입니다. 같은 세대 특성을 일반화하지 마세요.`);
  for (const [place, n] of Object.entries(byHomePlace)) if (n / total > 0.5) warnings.push(`생활권 ${place} 사례가 ${n}/${total}명입니다. 지역·인맥 효과를 예측력으로 해석하지 마세요.`);
  if (total < 30) warnings.push(`사건·사람 표본이 ${total}명뿐입니다. 이 사례집은 규칙 개발용이며 예측도 증명용이 아닙니다.`);
  return { total, byYear, byHomePlace, warnings };
}
