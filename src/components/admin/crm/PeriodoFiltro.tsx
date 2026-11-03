"use client";

import { camposDoPeriodo, DATAS_BASE, PERIODOS, type FiltroPeriodo } from "@/lib/crm/telas/periodo";

/** Kanban e Fila do dia guardam o mesmo período: escolhido numa tela, a outra abre filtrada igual. */
const CHAVE = "ea-crm-periodo";

export function lerPeriodoGuardado(): FiltroPeriodo {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as FiltroPeriodo;
    return camposDoPeriodo(typeof v === "object" && v ? v : {});
  } catch {
    return {};
  }
}

export function guardarPeriodo(f: FiltroPeriodo) {
  try {
    const campos = camposDoPeriodo(f);
    if (campos.periodo) window.localStorage.setItem(CHAVE, JSON.stringify(campos));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: o filtro vale só nesta tela */
  }
}

/** Período no link tem prioridade; sem ele, vale o guardado. */
export function periodoDaUrl(): FiltroPeriodo {
  try {
    const q = new URLSearchParams(window.location.search);
    return camposDoPeriodo({ periodo: q.get("periodo") ?? "", de: q.get("de") ?? "", ate: q.get("ate") ?? "", dataBase: q.get("dataBase") ?? "" });
  } catch {
    return {};
  }
}

/** Data (que data o período olha), Período e, no personalizado, De e Até. */
export function CamposPeriodo({ valor, onChange }: { valor: FiltroPeriodo; onChange: (campo: keyof FiltroPeriodo, v: string) => void }) {
  return (
    <>
      <label className="ea-crm-campo">
        <span>Período</span>
        <select value={valor.periodo ?? ""} onChange={(e) => onChange("periodo", e.target.value)}>
          <option value="">Qualquer data</option>
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="ea-crm-campo">
        <span>Data usada no período</span>
        <select value={valor.dataBase || "entrada"} onChange={(e) => onChange("dataBase", e.target.value === "entrada" ? "" : e.target.value)}>
          {DATAS_BASE.map((d) => (
            <option key={d.id} value={d.id}>
              {d.rotulo}
            </option>
          ))}
        </select>
      </label>
      {valor.periodo === "personalizado" ? (
        <>
          <label className="ea-crm-campo">
            <span>De</span>
            <input type="date" value={valor.de ?? ""} max={valor.ate || undefined} onChange={(e) => onChange("de", e.target.value)} />
          </label>
          <label className="ea-crm-campo">
            <span>Até</span>
            <input type="date" value={valor.ate ?? ""} min={valor.de || undefined} onChange={(e) => onChange("ate", e.target.value)} />
          </label>
        </>
      ) : null}
    </>
  );
}
