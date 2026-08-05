export const MIGRATION_NOTICE_KEY = "academic_hub_migration_notice_2026_08_05";
export const MIGRATION_NOTICE_DISMISSED_EVENT = "academic-hub:migration-notice-dismissed";

// O aviso fica disponível para todos até ao fim de 30 de setembro de 2026,
// considerando a hora de Portugal continental/Madeira durante o horário de verão.
const MIGRATION_NOTICE_VISIBLE_UNTIL = Date.parse("2026-10-01T00:00:00+01:00");

export function isMigrationNoticePending(): boolean {
  try {
    if (localStorage.getItem(MIGRATION_NOTICE_KEY) === "dismissed") return false;
  } catch {
    // Se o armazenamento local estiver indisponível, o aviso continua visível
    // durante o período de transição.
  }

  return Date.now() < MIGRATION_NOTICE_VISIBLE_UNTIL;
}
