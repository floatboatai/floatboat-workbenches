const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseStrictDate(value: unknown): Date {
  const invalid = () => new Error('时间无效，请使用有效 ISO 日期、带时区时间或明确的毫秒时间戳');
  if (typeof value === 'number') {
    // Small nonzero numbers can be Unix seconds. Older dates remain available as ISO strings.
    if (!Number.isSafeInteger(value) || value < 0 || (value !== 0 && value < 100000000000))
      throw invalid();
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw invalid();
    return date;
  }
  if (typeof value !== 'string') throw invalid();
  const input = value.trim();
  const parts = input.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?([Zz]|[+-]\d{2}:?\d{2}))?$/,
  );
  if (!parts) throw invalid();
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText = '00',
    minuteText = '00',
    secondText = '00',
    fraction = '',
    zone = 'Z',
  ] = parts;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offset = zone.match(/^[+-](\d{2}):?(\d{2})$/);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1] ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59 ||
    (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59))
  )
    throw invalid();
  const normalizedZone = offset ? `${zone[0]}${offset[1]}:${offset[2]}` : 'Z';
  const date = new Date(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}${fraction ? `.${fraction.slice(0, 3)}` : ''}${normalizedZone}`,
  );
  if (!Number.isFinite(date.getTime())) throw invalid();
  return date;
}

export function parseCombinedDate(value: string): Date {
  const parts = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/);
  if (!parts) throw new Error('日志时间无效');
  const month = months.indexOf(parts[2].toLowerCase()) + 1;
  return parseStrictDate(
    `${parts[3]}-${String(month).padStart(2, '0')}-${parts[1]}T${parts[4]}${parts[5]}`,
  );
}
