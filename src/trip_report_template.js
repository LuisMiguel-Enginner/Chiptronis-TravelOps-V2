

const SYSTEM_NAME = "Chiptronic TravelOps";

const THEME = {
  brand: "#0f172a",
  brandSoft: "#f1f5f9",
  border: "#e2e8f0",
  textMuted: "#64748b",
  ok: "#15803d",
  okSoft: "#dcfce7",
  pending: "#b45309",
  pendingSoft: "#fef3c7",
};

export function renderTripReportHTML(model) {
  const {
    general,
    members,
    tasksCompleted,
    tasksPending,
    userSummaries,
    generatedAt,
  } = model;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Viagem — ${esc(general.code)}</title>
<style>${css()}</style>
</head>
<body>
  ${renderHeader(general)}
  ${renderDadosGerais(general, members)}
  ${renderChecklistEncerramento(general, model.taskResults)}
  ${renderResumoPorUsuario(userSummaries)}
  ${renderAtividades("Atividades concluídas", tasksCompleted, "ok")}
  ${renderAtividades("Atividades pendentes", tasksPending, "pending")}
  ${renderAssinaturas(general)}
  ${renderFooter(generatedAt, general.code)}
</body>
</html>`;
}

function renderHeader(general) {
  return `
  <header class="report-header">
    <div class="report-header__brand">
      <span class="report-header__system">${esc(SYSTEM_NAME)}</span>
      <span class="report-header__tag">Relatório de Viagem</span>
    </div>
    <div class="report-header__code">
      <span>${esc(general.code)}</span>
      ${badgeStatus(general.status, general.statusLabel)}
    </div>
  </header>`;
}

function badgeStatus(status, label) {
  const cls = status === "completed" || status === "concluida" ? "ok" : "pending";
  return `<span class="badge badge--${cls}">${esc(label || status || "—")}</span>`;
}

function renderDadosGerais(general, members) {
  return `
  <section class="card">
    <h2 class="card__title">Dados gerais</h2>
    <div class="grid grid--2">
      ${field("Origem", general.origin)}
      ${field("Destino", general.destination)}
      ${field("Início", formatDate(general.startDate))}
      ${field("Término", formatDate(general.endDate))}
      ${field("Motivo", general.reason)}
      ${field("Setor", general.sector)}
      ${field("Prioridade", general.priority)}
      ${field("Funcionário", general.employee)}
      ${field("Coordenador responsável", general.coordinator)}
    </div>
    ${members?.length ? `
    <h3 class="card__subtitle">Participantes</h3>
    <table class="table">
      <thead><tr><th>Nome</th><th>Setor</th><th>Cargo</th></tr></thead>
      <tbody>${members.map((m) => `
        <tr>
          <td>${esc(m.fullName)}</td>
          <td>${esc(m.sector || "—")}</td>
          <td>${esc(m.positionTitle || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}
  </section>`;
}

function renderChecklistEncerramento(general, taskResults = []) {
  const objetivoLabel =
    general.objectiveMet === true ? "Sim" :
    general.objectiveMet === false ? "Não" : "Não informado";
  const objetivoCls =
    general.objectiveMet === true ? "ok" :
    general.objectiveMet === false ? "pending" : "";

  return `
  <section class="card card--highlight">
    <h2 class="card__title">Checklist de encerramento</h2>
    <div class="grid grid--2">
      <div class="field">
        <span class="field__label">Objetivo cumprido</span>
        <span class="badge badge--${objetivoCls}">${esc(objetivoLabel)}</span>
      </div>
      ${field("Encerrado em", formatDateTime(general.completedAt))}
    </div>
    ${longField("Observações do objetivo", general.objectiveNotes)}
    ${longField("Pessoas visitadas", general.peopleVisited)}
    ${longField("Resumo das atividades", general.activitiesSummary)}
    ${longField("Pendências gerais", general.generalPendingItems, general.generalPendingItems ? "pending" : "")}
    <h3 class="card__subtitle">Resultados das tarefas</h3>
    ${taskResults.length ? `<div class="task-results">${taskResults.map((task) => `
      <article class="task-result">
        <div class="task-result__header">
          <strong>${esc(task.workType || "Tarefa")}</strong>
          <span>${formatDate(task.date)} · ${esc(task.startTime || "—")}–${esc(task.endTime || "—")}</span>
        </div>
        ${task.location ? `<div class="task-result__location">Local: ${esc(task.location)}</div>` : ""}
        <p>${esc(task.summary || "Sem resumo informado.")}</p>
      </article>`).join("")}</div>` : '<p class="empty">Nenhum resultado de tarefa registrado.</p>'}
  </section>`;
}

function renderResumoPorUsuario(userSummaries) {
  if (!userSummaries?.length) return "";

  return `
  <section class="card">
    <h2 class="card__title">Resumo por usuário</h2>
    ${userSummaries.map((u) => `
    <div class="user-block">
      <div class="user-block__header">
        <strong>${esc(u.fullName)}</strong>
        <span class="user-block__stats">
          ${u.tasksCompleted}/${u.tasksAssigned} tarefas concluídas
          ${u.totalHoursWorked !== null ? ` · ${u.totalHoursWorked}h registradas` : ""}
        </span>
      </div>
      <table class="table table--compact">
        <thead><tr><th>Data</th><th>Horários</th></tr></thead>
        <tbody>${u.days.map((d) => `
          <tr>
            <td>${formatDate(d.date)}</td>
            <td>${d.slots.map((s) => `
              <span class="slot">${s.start || "—"}–${s.end || "—"}${s.workType ? ` (${esc(s.workType)})` : ""}</span>
            `).join(" ")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("")}
  </section>`;
}

function renderAtividades(title, tasks, tone) {
  if (!tasks?.length) {
    return `
    <section class="card">
      <h2 class="card__title">${esc(title)}</h2>
      <p class="empty">Nenhuma atividade nesta categoria.</p>
    </section>`;
  }

  return `
  <section class="card">
    <h2 class="card__title">${esc(title)} <span class="badge badge--${tone}">${tasks.length}</span></h2>
    <table class="table">
      <thead><tr><th>Data</th><th>Horário</th><th>Tarefa</th><th>Responsáveis</th>${tone === "pending" ? "<th>Pendência</th>" : ""}</tr></thead>
      <tbody>${tasks.map((t) => {
        const responsibles = t.responsibles?.length ? t.responsibles : t.responsible ? [t.responsible] : [];
        return `
        <tr>
          <td>${formatDate(t.task_date)}</td>
          <td>${t.start_time || "—"}–${t.end_time || "—"}</td>
          <td>${esc(t.title || t.work_type || "—")}</td>
          <td>${responsibles.map((r) => esc(r.full_name)).join(", ") || "—"}</td>
          ${tone === "pending" ? `<td class="text--pending">${esc(t.pending_items)}</td>` : ""}
        </tr>`;
      }).join("")}</tbody>
    </table>
  </section>`;
}

function renderAssinaturas(general) {
  return `
  <section class="card signatures">
    <h2 class="card__title">Assinaturas</h2>
    <div class="grid grid--2">
      <div class="signature"><div class="signature__line"></div><span>${esc(general.employee || "Funcionário")}</span><span class="signature__role">Colaborador</span></div>
      <div class="signature"><div class="signature__line"></div><span>${esc(general.coordinator || "Coordenador")}</span><span class="signature__role">Coordenador responsável</span></div>
    </div>
  </section>`;
}

function renderFooter(generatedAt, code) {
  return `
  <footer class="report-footer">
    <span>${esc(SYSTEM_NAME)} · Relatório ${esc(code)}</span>
    <span>Gerado em ${formatDateTime(generatedAt)}</span>
  </footer>`;
}

function field(label, value) {
  return `<div class="field"><span class="field__label">${esc(label)}</span><span class="field__value">${value ? esc(value) : "—"}</span></div>`;
}

function longField(label, value, tone = "") {
  if (!value) return "";
  return `<div class="field field--long ${tone ? `field--${tone}` : ""}"><span class="field__label">${esc(label)}</span><p class="field__value">${esc(value)}</p></div>`;
}

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return esc(String(d));
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return esc(String(d));
  return date.toLocaleString("pt-BR");
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function css() {
  return `
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; margin: 0; }
  .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${THEME.brand}; padding-bottom: 12px; margin-bottom: 20px; }
  .report-header__brand { display: flex; flex-direction: column; }
  .report-header__system { font-weight: 700; font-size: 16px; color: ${THEME.brand}; }
  .report-header__tag { font-size: 12px; color: ${THEME.textMuted}; }
  .report-header__code { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .card { border: 1px solid ${THEME.border}; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; break-inside: avoid; }
  .card--highlight { border-color: ${THEME.brand}; background: ${THEME.brandSoft}; }
  .card__title { font-size: 14px; margin: 0 0 12px; color: ${THEME.brand}; display: flex; align-items: center; gap: 8px; }
  .card__subtitle { font-size: 13px; margin: 14px 0 8px; color: ${THEME.brand}; }
  .grid { display: grid; gap: 10px 20px; }
  .grid--2 { grid-template-columns: 1fr 1fr; }
  .field { display: flex; flex-direction: column; gap: 2px; }
  .field--long { grid-column: 1 / -1; margin-top: 8px; }
  .field--pending .field__value { color: ${THEME.pending}; }
  .field__label { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: ${THEME.textMuted}; }
  .field__value { font-size: 13px; margin: 0; }
  .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .table th, .table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid ${THEME.border}; font-size: 12px; vertical-align: top; }
  .table th { color: ${THEME.textMuted}; font-weight: 600; }
  .table--compact td, .table--compact th { padding: 4px 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: ${THEME.border}; color: #334155; }
  .badge--ok { background: ${THEME.okSoft}; color: ${THEME.ok}; }
  .badge--pending { background: ${THEME.pendingSoft}; color: ${THEME.pending}; }
  .slot { display: inline-block; background: ${THEME.brandSoft}; border-radius: 4px; padding: 1px 6px; margin: 2px 4px 2px 0; font-size: 11px; }
  .text--pending { color: ${THEME.pending}; }
  .empty { color: ${THEME.textMuted}; font-size: 12px; }
  .task-results { display: grid; gap: 8px; }
  .task-result { border: 1px solid ${THEME.border}; border-radius: 6px; padding: 8px 10px; background: #fff; break-inside: avoid; }
  .task-result__header { display: flex; justify-content: space-between; gap: 12px; color: ${THEME.brand}; }
  .task-result__header span, .task-result__location { color: ${THEME.textMuted}; font-size: 11px; }
  .task-result p { margin: 5px 0 0; white-space: pre-wrap; }
  .user-block { margin-bottom: 14px; }
  .user-block__header { display: flex; justify-content: space-between; align-items: baseline; }
  .user-block__stats { font-size: 11px; color: ${THEME.textMuted}; }
  .signatures .grid--2 { margin-top: 30px; }
  .signature { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .signature__line { width: 90%; border-top: 1px solid #1e293b; margin-bottom: 6px; margin-top: 40px; }
  .signature__role { font-size: 11px; color: ${THEME.textMuted}; }
  .report-footer { display: flex; justify-content: space-between; border-top: 1px solid ${THEME.border}; padding-top: 8px; margin-top: 24px; font-size: 10px; color: ${THEME.textMuted}; }
  @media print { .card { break-inside: avoid; } }
  `;
}
