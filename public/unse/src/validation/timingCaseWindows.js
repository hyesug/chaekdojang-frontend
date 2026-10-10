/**
 * 시기 검증용 사건 창.
 *
 * 한 사람의 관계 사건이 2010년에 있다고 해서 2020년대 직업 시계열의 분모가
 * 바뀌면, 사건을 추가할수록 직업 성적도 흔들린다. 사람·분야 단위로 사건을
 * 묶어 독립적인 관측 창을 만든다.
 */
export function groupTimingEvents(cases, domainOf, { paddingYears = 3 } = {}) {
  const groups = new Map();
  for (const person of cases ?? []) {
    for (const event of person.events ?? []) {
      const domain = domainOf[event.domain];
      if (!domain || !Number.isInteger(event.year)) continue;
      const key = `${person.id}\u0000${domain}`;
      const group = groups.get(key) ?? {
        person: person.id, domain, birth: person.birth, events: [],
      };
      group.events.push(event);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((group) => {
    const years = group.events.map((event) => event.year);
    const fromYear = Math.min(...years) - paddingYears;
    const toYear = Math.max(...years) + paddingYears;
    return {
      ...group,
      from: `${fromYear}-01`,
      to: `${toYear}-12`,
    };
  });
}
