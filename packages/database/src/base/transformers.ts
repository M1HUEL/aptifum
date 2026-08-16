export const numericTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null | undefined) => (typeof value === 'string' ? Number(value) : value),
};
