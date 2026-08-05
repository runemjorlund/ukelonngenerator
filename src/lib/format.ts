export const formatMoney = (ore: number) => {
  const showDecimals = Math.abs(ore) % 100 !== 0
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(ore / 100)
}

export const formatDate = (value: string) => new Intl.DateTimeFormat('nb-NO', {
  dateStyle: 'medium',
}).format(new Date(value))

export const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'Noe gikk galt. Prøv igjen.'
