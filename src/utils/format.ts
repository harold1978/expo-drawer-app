const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-CR', {
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

export const formatNumber = (value: number): string =>
  numberFormatter.format(Number.isFinite(value) ? value : 0);

export const formatDate = (date?: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return '--';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
};

export const parseDateInput = (value: string): Date | null => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};
