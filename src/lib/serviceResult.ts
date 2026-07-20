export type ServiceResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number };

export const success = <T>(data: T): ServiceResult<T> => ({ ok: true, data });

export const failure = (message: string, status?: number): ServiceResult<never> => ({
  ok: false,
  message,
  status,
});
