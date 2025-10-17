export type AuthorityDescriptor = {
  authority: string;
};

export const normalizeRoleValue = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/^ROLE_/, "")
    .toUpperCase();
};

export const extractAuthorityRoles = (
  authorities?: AuthorityDescriptor[] | null
): string[] => {
  if (!authorities?.length) {
    return [];
  }

  return authorities
    .map((auth) => normalizeRoleValue(auth.authority))
    .filter((role): role is string => Boolean(role));
};

export const hasAnyRole = (
  normalizedRole: string | null,
  authorityRoles: string[],
  targets: string[]
): boolean => {
  return targets.some(
    (target) => normalizedRole === target || authorityRoles.includes(target)
  );
};
