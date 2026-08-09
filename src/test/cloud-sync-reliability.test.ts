import { describe, expect, it } from "vitest";

import { defaultState } from "@/lib/storage";
import { hasSameCloudContent, isChangeFromAnotherDevice } from "@/lib/realtimeSync";

function stateWithCourse(name: string) {
  const state = defaultState();
  state.degree = { id: "lic-info", name: "Licenciatura em Engenharia Informática" };
  state.courses = [{
    id: "course-1",
    code: "21000",
    name,
    year: 1,
    semester: 1,
    isActive: true,
    isCompleted: false,
    evaluationRegime: "legacy",
    evaluationModel: "custom",
  }];
  return state;
}

describe("realtime cloud safeguards", () => {
  it("ignora notificações originadas no próprio dispositivo", () => {
    const payload = { new: { user_id: "user-1", state: { ...defaultState(), syncMeta: { deviceId: "device-a" } } } };
    expect(isChangeFromAnotherDevice(payload, "user-1", "device-a")).toBe(false);
  });

  it("aceita alterações do mesmo utilizador noutro dispositivo", () => {
    const payload = { new: { user_id: "user-1", state: { ...defaultState(), syncMeta: { deviceId: "device-b" } } } };
    expect(isChangeFromAnotherDevice(payload, "user-1", "device-a")).toBe(true);
  });

  it("nunca reage a alterações pertencentes a outro utilizador", () => {
    const payload = { new: { user_id: "user-2", state: { ...defaultState(), syncMeta: { deviceId: "device-b" } } } };
    expect(isChangeFromAnotherDevice(payload, "user-1", "device-a")).toBe(false);
  });

  it("compara apenas o conteúdo sincronizável e deteta alterações académicas reais", () => {
    const first = stateWithCourse("Programação");
    const same = { ...first, sync: { enabled: true, lastSyncAt: "2026-08-09T10:00:00Z" } };
    const changed = stateWithCourse("Programação Avançada");
    expect(hasSameCloudContent(first, same)).toBe(true);
    expect(hasSameCloudContent(first, changed)).toBe(false);
  });
});
