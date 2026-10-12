import { Role } from "@prisma/client";

/** Ordered from most to least privileged. Used for UI hints and defaults. */
export const ROLES: Role[] = [
  "OWNER",
  "EDITOR",
  "FACT_CHECKER",
  "MEDIA_ANALYST",
  "GEO_ANALYST",
  "SOCIAL_PUBLISHER",
  "VIEWER",
];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "مسؤول",
  EDITOR: "محرر",
  FACT_CHECKER: "مدقق الحقائق",
  MEDIA_ANALYST: "محلل إعلامي",
  GEO_ANALYST: "محلل جغرافي",
  SOCIAL_PUBLISHER: "الناشر الاجتماعي",
  VIEWER: "مشاهد",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "إدارة كاملة للمنصة",
  EDITOR: "تحرير المحتوى وإدارة الأخبار",
  FACT_CHECKER: "التحقق من الأخبار والادعاءات",
  MEDIA_ANALYST: "فحص الصور والفيديو",
  GEO_ANALYST: "التحقق من الجغرافيا والخرائط",
  SOCIAL_PUBLISHER: "إدارة النشر على الشبكات الاجتماعية",
  VIEWER: "مشاهدة فقط",
};

export const PERMISSIONS = [
  "content:create",
  "content:edit",
  "content:publish",
  "content:verify",
  "report:submit",
  "report:triage",
  "media:analyze",
  "geo:verify",
  "social:manage",
  "agents:manage",
  "platform:manage",
  "security:manage",
  "users:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER_PERMS: Permission[] = ["report:submit"];

const EDITOR_PERMS: Permission[] = [
  ...VIEWER_PERMS,
  "content:create",
  "content:edit",
];

const FACT_CHECKER_PERMS: Permission[] = [
  ...EDITOR_PERMS,
  "content:verify",
  "report:triage",
  "audit:view",
];

const MEDIA_ANALYST_PERMS: Permission[] = [...VIEWER_PERMS, "media:analyze"];

const GEO_ANALYST_PERMS: Permission[] = [...VIEWER_PERMS, "geo:verify"];

const SOCIAL_PUBLISHER_PERMS: Permission[] = [
  ...VIEWER_PERMS,
  "content:publish",
  "social:manage",
];

const OWNER_PERMS: Permission[] = [...PERMISSIONS];

/** Agents run the editorial pipeline; the roles that own that work may manage them. */
const AGENT_MANAGER_PERMS: Permission[] = ["agents:manage"];

/** Server-side source of truth for role → permission mapping. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: OWNER_PERMS,
  EDITOR: [...EDITOR_PERMS, ...AGENT_MANAGER_PERMS, "platform:manage"],
  FACT_CHECKER: [...FACT_CHECKER_PERMS, ...AGENT_MANAGER_PERMS, "security:manage"],
  MEDIA_ANALYST: MEDIA_ANALYST_PERMS,
  GEO_ANALYST: GEO_ANALYST_PERMS,
  SOCIAL_PUBLISHER: [...SOCIAL_PUBLISHER_PERMS, ...AGENT_MANAGER_PERMS],
  VIEWER: VIEWER_PERMS,
};

export function roleHasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleHasAny(role: Role | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  "content:create": "إنشاء محتوى",
  "content:edit": "تعديل المحتوى",
  "content:publish": "نشر المحتوى",
  "content:verify": "التحقق من المحتوى",
  "report:submit": "إرسال بلاغ",
  "report:triage": "فرز البلاغات",
  "media:analyze": "تحليل الوسائط",
  "geo:verify": "التحقق الجغرافي",
  "social:manage": "إدارة النشر الاجتماعي",
  "agents:manage": "إدارة الوكلاء الأذكياء",
  "platform:manage": "إدارة هوية المنصة وصفحاتها",
  "security:manage": "إدارة الأمن وسلامة الإعدادات",
  "users:manage": "إدارة المستخدمين",
  "audit:view": "عرض سجل التدقيق",
};
