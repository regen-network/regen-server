import * as env from 'env-var';

export const sameSiteFromEnv = (
  key: string,
): boolean | 'lax' | 'strict' | 'none' => {
  const value = env
    .get(key)
    .default('lax')
    .asEnum(['true', 'false', 'lax', 'strict', 'none']);
  if (value === 'true' || value === 'false') {
    return value === 'true';
  } else {
    return value;
  }
};
