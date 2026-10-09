const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
});

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Moscow',
});

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : '-';
}

export function weekRange(startsAt: string, endsAt: string): string {
  const end = new Date(new Date(endsAt).getTime() - 1);
  return `${dayFormat.format(new Date(startsAt))} - ${dayFormat.format(end)}`;
}
