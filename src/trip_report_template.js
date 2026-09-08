// src/trip_report_template.js
// Gera o HTML do Relatório de Viagem a partir do "modelo" produzido por
// buildTripReportModel() (src/trip_report.js).
//
// IMPORTANTE: o export em PDF do sistema usa html2canvas (via html2pdf.js,
// em trip-detail.js -> showReportExportOptions). O html2canvas tem suporte
// ruim/inconsistente para `display:flex` e `display:grid`, então este
// template evita os dois de propósito e usa <table>/blocos simples —
// é o que garante que o PDF saia igual ao que aparece na tela.

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
  const { general, members, tasksCompleted, tasksPending, userSummaries, generatedAt } = model;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Viagem — ${esc(general.code)}</title>
<style>${css()}</style>
</head>
<body>
  <div class="page">

    ${renderHeader(general)}
    ${renderDadosGerais(general, members)}
    ${renderChecklistEncerramento(general, model.taskResults)}
    ${renderResumoPorUsuario(userSummaries)}
    ${renderAtividades("Atividades concluídas", tasksCompleted, "ok")}
    ${renderAtividades("Atividades pendentes", tasksPending, "pending")}
    ${renderAssinaturas(general)}
    ${renderFooter(generatedAt, general.code)}

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------
// Cabeçalho — table de 1 linha / 2 colunas em vez de flex
// ---------------------------------------------------------------------
function renderHeader(general) {
  return `
  <table class="report-header" role="presentation">
    <tr>
      <td class="report-header__brand">
        <div class="report-header__system">${esc(SYSTEM_NAME)}</div>
        <div class="report-header__tag">Relatório de Viagem</div>
      </td>
      <td class="report-header__code">
        <div>${esc(general.code)}</div>
        <div>${badgeStatus(general.status, general.statusLabel)}</div>
      </td>
    </tr>
  </table>`;
}

function badgeStatus(status, label) {
  const cls = status === "completed" || status === "concluida" ? "ok" : "pending";
  return `<span class="badge badge--${cls}">${esc(label || status || "—")}</span>`;
}

// ---------------------------------------------------------------------
// Dados gerais completos (SEM equipment_checklist)
// ---------------------------------------------------------------------
function renderDadosGerais(general, members) {
  const rows = [
    ["Origem", general.origin],
    ["Destino", general.destination],
    ["Início", formatDate(general.startDate)],
    ["Término", formatDate(general.endDate)],
    ["Motivo", general.reason],
    ["Setor", general.sector],
    ["Prioridade", general.priority],
    ["Funcionário", general.employee],
    ["Coordenador responsável", general.coordinator],
  ];

  return `
  <section class="card">
    <h2 class="card__title">Dados gerais</h2>
    ${fieldTable(rows)}

    ${members?.length ? `
    <h3 class="card__subtitle">Participantes</h3>
    <table class="table">
      <thead><tr><th>Nome</th><th>Setor</th><th>Cargo</th></tr></thead>
      <tbody>
        ${members.map((m) => `
        <tr>
          <td>${esc(m.fullName)}</td>
          <td>${esc(m.sector || "—")}</td>
          <td>${esc(m.positionTitle || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}
  </section>`;
}

// ---------------------------------------------------------------------
// Checklist de encerramento — seção prioritária
// ---------------------------------------------------------------------
function renderChecklistEncerramento(general, taskResults = []) {
  const objetivoLabel =
    general.objectiveMet === true ? "Sim" :
    general.objectiveMet === false ? "Não" : "Não informado";
  const objetivoCls = general.objectiveMet === true ? "ok" : general.objectiveMet === false ? "pending" : "";

  return `
  <section class="card card--highlight">
    <h2 class="card__title">Checklist de encerramento</h2>

    ${fieldTable([
      ["Objetivo cumprido", null, `<span class="badge badge--${objetivoCls}">${esc(objetivoLabel)}</span>`],
      ["Encerrado em", formatDateTime(general.completedAt)],
    ])}

    ${longField("Observações do objetivo", general.objectiveNotes)}
    ${longField("Pessoas visitadas", general.peopleVisited)}
    ${longField("Resumo das atividades", general.activitiesSummary)}
    ${longField("Pendências gerais", general.generalPendingItems, general.generalPendingItems ? "pending" : "")}

    <h3 class="card__subtitle">Resultados das tarefas</h3>
    ${taskResults.length ? taskResults.map((task) => `
      <div class="task-result">
        <table class="task-result__head" role="presentation">
          <tr>
            <td><strong>${esc(task.workType || "Tarefa")}</strong></td>
            <td class="task-result__when">${formatDate(task.date)} · ${esc(task.startTime || "—")}–${esc(task.endTime || "—")}</td>
          </tr>
        </table>
        ${task.location ? `<div class="task-result__location">Local: ${esc(task.location)}</div>` : ""}
        <p>${esc(task.summary || "Sem resumo informado.")}</p>
      </div>`).join("") : '<p class="empty">Nenhum resultado de tarefa registrado.</p>'}
  </section>`;
}

// ---------------------------------------------------------------------
// Resumo por usuário — horários agrupados por dia
// ---------------------------------------------------------------------
function renderResumoPorUsuario(userSummaries) {
  if (!userSummaries?.length) return "";

  return `
  <section class="card">
    <h2 class="card__title">Resumo por usuário</h2>
    ${userSummaries.map((u) => `
    <div class="user-block">
      <table class="user-block__head" role="presentation">
        <tr>
          <td><strong>${esc(u.fullName)}</strong></td>
          <td class="user-block__stats">
            ${u.tasksCompleted}/${u.tasksAssigned} tarefas concluídas
            ${u.totalHoursWorked !== null ? ` · ${u.totalHoursWorked}h registradas` : ""}
          </td>
        </tr>
      </table>
      <table class="table table--compact">
        <thead><tr><th>Data</th><th>Horário</th><th>Atividade</th></tr></thead>
        <tbody>
          ${u.days.flatMap((d) => d.slots.map((s, i) => `
          <tr>
            <td>${i === 0 ? formatDate(d.date) : ""}</td>
            <td>${s.start || "—"}–${s.end || "—"}</td>
            <td>${s.workType ? esc(s.workType) : "—"}</td>
          </tr>`)).join("")}
        </tbody>
      </table>
    </div>`).join("")}
  </section>`;
}

// ---------------------------------------------------------------------
// Atividades concluídas / pendentes
// ---------------------------------------------------------------------
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
      <thead>
        <tr>
          <th>Data</th>
          <th>Horário</th>
          <th>Tarefa</th>
          <th>Responsáveis</th>
          ${tone === "pending" ? "<th>Pendência</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${tasks.map((t) => {
          const responsibles = t.responsibles?.length
            ? t.responsibles
            : t.responsible ? [t.responsible] : [];
          return `
        <tr>
          <td>${formatDate(t.task_date)}</td>
          <td>${t.start_time || "—"}–${t.end_time || "—"}</td>
          <td>${esc(t.title || t.work_type || "—")}</td>
          <td>${responsibles.map((r) => esc(r.full_name)).join(", ") || "—"}</td>
          ${tone === "pending" ? `<td class="text--pending">${esc(t.pending_items)}</td>` : ""}
        </tr>`;
        }).join("")}
      </tbody>
    </table>
  </section>`;
}

// ---------------------------------------------------------------------
// Assinaturas — padrão fixo, com espaço em branco de verdade pra
// preencher à mão (linha + data), lado a lado via table
// ---------------------------------------------------------------------
function renderAssinaturas(general) {
  return `
  <section class="card signatures">
    <h2 class="card__title">Assinaturas</h2>
    <table class="signatures__table" role="presentation">
      <tr>
        <td class="signature">
          <div class="signature__space"></div>
          <div class="signature__name">${esc(general.employee || "Funcionário")}</div>
          <div class="signature__role">Colaborador</div>
          <div class="signature__date">Data: ____ / ____ / ______</div>
        </td>
        <td class="signature">
          <div class="signature__space"></div>
          <div class="signature__name">${esc(general.coordinator || "Coordenador")}</div>
          <div class="signature__role">Coordenador responsável</div>
          <div class="signature__date">Data: ____ / ____ / ______</div>
        </td>
      </tr>
    </table>
  </section>`;
}

// ---------------------------------------------------------------------
// Rodapé temático — barra sólida com a cor da marca e o nome do sistema
// ---------------------------------------------------------------------
function renderFooter(generatedAt, code) {
  return `
  <table class="report-footer" role="presentation">
    <tr>
      <td class="report-footer__brand">${esc(SYSTEM_NAME)}</td>
      <td class="report-footer__meta">Relatório ${esc(code)} · Gerado em ${formatDateTime(generatedAt)}</td>
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------
// Helpers de campo — tabela de 2 colunas (label em cima, valor embaixo,
// dentro da mesma célula, sempre em elementos de bloco, nunca inline)
// ---------------------------------------------------------------------
function fieldTable(rows) {
  // rows: [label, value] ou [label, value, customHtml]
  const pairs = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push([rows[i], rows[i + 1]]);

  return `
  <table class="field-table" role="presentation">
    ${pairs.map(([a, b]) => `
    <tr>
      <td class="field-cell">${fieldCell(a)}</td>
      <td class="field-cell">${b ? fieldCell(b) : ""}</td>
    </tr>`).join("")}
  </table>`;
}

function fieldCell([label, value, customHtml]) {
  return `
    <div class="field__label">${esc(label)}</div>
    <div class="field__value">${customHtml || (value ? esc(value) : "—")}</div>`;
}

function longField(label, value, tone = "") {
  if (!value) return "";
  return `
  <div class="field field--long ${tone ? `field--${tone}` : ""}">
    <div class="field__label">${esc(label)}</div>
    <p class="field__value">${esc(value)}</p>
  </div>`;
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

// ---------------------------------------------------------------------
// CSS — SEM flexbox e SEM grid de propósito (html2canvas renderiza mal
// os dois). Layout 100% em <table> / blocos, o que é o que o
// html2canvas + jsPDF conseguem rasterizar de forma previsível.
// ---------------------------------------------------------------------
function css() {
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
    background: #ffffff;
  }
  .page { width: 794px; min-height: 1123px; padding: 42px 46px 30px; margin: 0 auto; background: #ffffff; }

  /* Cabeçalho */
  .report-header { width: 100%; border-collapse: collapse; border-bottom: 3px solid ${THEME.brand}; margin-bottom: 18px; }
  .report-header td { padding-bottom: 10px; vertical-align: bottom; }
  .report-header__brand { text-align: left; }
  .report-header__system { font-weight: 700; font-size: 17px; color: ${THEME.brand}; }
  .report-header__tag { font-size: 12px; color: ${THEME.textMuted}; margin-top: 2px; }
  .report-header__code { text-align: right; font-weight: 600; }
  .report-header__code div:first-child { margin-bottom: 4px; }

  /* Cards */
  .card {
    border: 1px solid ${THEME.border}; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 14px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .card--highlight { border-color: ${THEME.brand}; background: ${THEME.brandSoft}; }
  .card__title {
    font-size: 14px; margin: 0 0 12px; color: ${THEME.brand}; font-weight: 700;
  }
  .card__subtitle { font-size: 13px; margin: 14px 0 8px; color: ${THEME.brand}; font-weight: 700; }

  /* Tabela de campos (substitui o antigo .grid + .field em flex) */
  .field-table { width: 100%; border-collapse: collapse; }
  .field-table td.field-cell { width: 50%; vertical-align: top; padding: 6px 10px 10px 0; }
  .field__label { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: ${THEME.textMuted}; margin-bottom: 2px; }
  .field__value { font-size: 13px; margin: 0; }
  .field--long { margin-top: 10px; }
  .field--pending .field__value { color: ${THEME.pending}; }

  /* Tabelas de dados (participantes, tarefas, resumo por usuário) */
  .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .table thead { display: table-header-group; }
  .table tr { page-break-inside: avoid; }
  .table th, .table td {
    text-align: left; padding: 6px 8px; border-bottom: 1px solid ${THEME.border};
    font-size: 12px; vertical-align: top;
  }
  .table th { color: ${THEME.textMuted}; font-weight: 600; }
  .table--compact td, .table--compact th { padding: 4px 8px; }

  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 11px; font-weight: 600; background: ${THEME.border}; color: #334155;
  }
  .badge--ok { background: ${THEME.okSoft}; color: ${THEME.ok}; }
  .badge--pending { background: ${THEME.pendingSoft}; color: ${THEME.pending}; }

  .text--pending { color: ${THEME.pending}; }
  .empty { color: ${THEME.textMuted}; font-size: 12px; }

  /* Resultados das tarefas dentro do checklist */
  .task-result { border: 1px solid ${THEME.border}; border-radius: 6px; padding: 8px 10px; background: #fff; margin-bottom: 8px; page-break-inside: avoid; }
  .task-result__head { width: 100%; }
  .task-result__head td { padding: 0; color: ${THEME.brand}; }
  .task-result__when { text-align: right; color: ${THEME.textMuted}; font-size: 11px; }
  .task-result__location { color: ${THEME.textMuted}; font-size: 11px; margin-top: 2px; }
  .task-result p { margin: 6px 0 0; white-space: pre-wrap; }

  /* Resumo por usuário */
  .user-block { margin-bottom: 16px; }
  .user-block__head { width: 100%; margin-bottom: 4px; }
  .user-block__head td { padding: 0; }
  .user-block__stats { text-align: right; font-size: 11px; color: ${THEME.textMuted}; }

  /* Assinaturas — espaço em branco de verdade + linha + data */
  .signatures { page-break-before: always; }
  .signatures__table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .signature { width: 50%; text-align: center; vertical-align: bottom; padding: 0 16px; }
  .signature__space { height: 46px; border-bottom: 1px solid #1e293b; }
  .signature__name { margin-top: 8px; font-weight: 600; font-size: 12px; }
  .signature__role { font-size: 11px; color: ${THEME.textMuted}; margin-top: 1px; }
  .signature__date { font-size: 11px; color: ${THEME.textMuted}; margin-top: 10px; }

  /* Rodapé temático — barra sólida com a cor da marca */
  .report-footer { width: 100%; border-collapse: collapse; margin-top: 26px; background: ${THEME.brand}; page-break-inside: avoid; }
  .report-footer td { padding: 8px 12px; font-size: 10px; color: #ffffff; }
  .report-footer__brand { font-weight: 700; letter-spacing: .03em; }
  .report-footer__meta { text-align: right; color: #cbd5e1; }
  `;
}