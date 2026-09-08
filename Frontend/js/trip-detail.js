import { api, hideAlert, showAlert } from "./api.js";
import { renderQuadroDemandasIntegrante } from "./demandas.js";
import { mountShell } from "./layout.js";
import {
  fillWorkTypes,
  prepareTaskForm,
  renderTrip,
  taskFormPayload,
  validateTaskTimeAvailability,
  hasPersonalTaskConflict,
  hasConfirmedPersonalTaskConflict,
  setupPanelToggles,
} from "./trip-render.js?v=2";
import { confirmDialog } from "./ui.js";
import {
  getLocationConsent,
  setLocationConsent,
  startTripLocationMonitor,
  stopTripLocationMonitor,
  isMonitoringActive,
  registrarCheckinTrabalho,
} from "./location.js";

function getTripDays(startDate, endDate) {
  const days = [];
  if (!startDate || !endDate || endDate < startDate) return days;
  let current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function hasTaskEveryTripDay(trip) {
  if (!trip || !trip.start_date || !trip.end_date || !Array.isArray(trip.tasks))
    return false;
  const requiredDays = getTripDays(trip.start_date, trip.end_date);
  const taskDates = new Set(
    trip.tasks
      .map((task) => String(task.task_date || "").trim())
      .filter(Boolean),
  );
  return requiredDays.every((date) => taskDates.has(date));
}

const params = new URLSearchParams(location.search);
const tripId = Number(params.get("id"));
const alertEl = document.getElementById("alert");


let monitorMetricsTimer = null;

function updateLocationMonitorStatus(trip, extra = {}) {
  const statusEl = document.getElementById('location-monitor-status');
  const panelEl = document.getElementById('location-monitor-panel');
  const metricsEl = document.getElementById('loc-last-checkin');
  const metricsWrap = document.getElementById('location-monitor-metrics');
  if (!statusEl || !panelEl) return;

  panelEl.classList.remove('hidden-fields');

  const consent = getLocationConsent(tripId);

  if (!trip || trip.status !== 'in_progress') {
    panelEl.classList.add('hidden-fields');
    return;
  }

  statusEl.className = 'alert';
  if (extra.error) {
    statusEl.classList.add('alert-error');
    statusEl.textContent = String(extra.error);
  } else if (isMonitoringActive(tripId)) {
    statusEl.classList.add('alert-success');
    statusEl.textContent = '🟢 Monitoramento ativo — sua localização está sendo compartilhada com o Mapa Operacional.';
    if (metricsWrap) metricsWrap.classList.remove('hidden-fields');
  } else if (consent === true) {
    statusEl.classList.add('alert-warning');
    statusEl.textContent = 'Compartilhamento ativado, aguardando primeira leitura de localização…';
  } else if (consent === false) {
    statusEl.classList.add('alert-info');
    statusEl.textContent = 'Compartilhamento desativado. Ligue o toggle acima se quiser participar do Mapa Operacional.';
  } else {
    statusEl.classList.add('alert-info');
    statusEl.textContent = 'Ative o compartilhamento para enviar sua posição durante esta viagem.';
  }

  if (metricsEl) {
    try {
      const key = `cto_last_checkin_${tripId}`;
      const raw = localStorage.getItem(key);
      const last = raw ? JSON.parse(raw) : null;
      if (last?.at) {
        const d = new Date(last.at);
        metricsEl.textContent = `Último check-in: ${d.toLocaleString('pt-BR')} · Lat ${Number(last.latitude).toFixed(5)}, Lon ${Number(last.longitude).toFixed(5)}`;
      } else {
        metricsEl.textContent = 'Nenhum check-in registrado ainda nesta viagem.';
      }
    } catch {}
  }
}

function showReportExportOptions(reportBlob) {
  const existing = document.getElementById("report-export-modal");
  existing?.remove();

  const previewUrl = URL.createObjectURL(
    new Blob([reportBlob], { type: "text/html;charset=utf-8" }),
  );

  const modal = document.createElement("div");
  modal.id = "report-export-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="report-export-title">
      <div class="modal-head">
        <div class="modal-icon info">📄</div>
        <div>
          <h3 id="report-export-title" class="modal-title">Relatório de viagem pronto</h3>
          <p class="modal-text">Prévia abaixo. Escolha uma opção para visualizar ou exportar.</p>
        </div>
      </div>
      <div class="modal-body">
        <div class="report-preview-frame-wrap">
          <iframe class="report-preview-frame" src="${previewUrl}" title="Prévia do relatório"></iframe>
        </div>
      </div>
      <div class="modal-footer modal-footer--spread">
        <button type="button" class="btn btn-secondary" data-export="preview">
          🔍 Abrir em nova aba
        </button>
        <button type="button" class="btn btn-secondary" data-export="word">
          📝 Exportar Word
        </button>
        <button type="button" class="btn btn-primary" data-export="pdf">
          📑 Exportar PDF
        </button>
        <button type="button" class="btn btn-ghost" data-export="cancel">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => {
    URL.revokeObjectURL(previewUrl);
    modal.remove();
  };
  modal.querySelector('[data-export="cancel"]').addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  modal.querySelector('[data-export="preview"]').addEventListener("click", () => {
    const win = window.open(previewUrl, "_blank");
    if (!win) showAlert(alertEl, "O navegador bloqueou a abertura. Permita pop-ups para este site.");
  });

  modal.querySelector('[data-export="word"]').addEventListener("click", () => {
    if (typeof window.html2canvas !== "function") {
      showAlert(alertEl, "O exportador Word ainda está carregando. Tente novamente.");
      return;
    }

    (async () => {
      try {
        let reportHTML;
        if (typeof reportBlob === "string") {
          reportHTML = reportBlob;
        } else if (reportBlob instanceof Blob || (reportBlob && typeof reportBlob.arrayBuffer === "function")) {
          const buf = await reportBlob.arrayBuffer();
          reportHTML = new TextDecoder("utf-8").decode(buf);
        } else if (reportBlob && reportBlob.byteLength !== undefined) {
          reportHTML = new TextDecoder("utf-8").decode(reportBlob);
        } else {
          reportHTML = String(reportBlob);
        }
        const A4_WIDTH_PX = 794;
        const MARGIN_MM = 14;
        const MARGIN_PX_LEFT_RIGHT = Math.round((MARGIN_MM / 25.4) * 96 * 2);
        const CONTENT_W = Math.max(680, A4_WIDTH_PX - MARGIN_PX_LEFT_RIGHT);

        const stageId = "word-render-stage";
        document.getElementById(stageId)?.remove();

        const stage = document.createElement("div");
        stage.id = stageId;
        Object.assign(stage.style, {
          position: "absolute",
          left: "0",
          top: "0",
          width: `${CONTENT_W}px`,
          height: "auto",
          background: "#ffffff",
          zIndex: "999998",
          margin: "0",
          padding: "0",
          pointerEvents: "none",
          overflow: "visible",
          opacity: "0",
          visibility: "hidden",
          transform: "none",
        });
        document.body.appendChild(stage);
        document.body.style.overflow = "hidden";
        stage.innerHTML = reportHTML;
        const pageEl = stage.querySelector(".page");
        if (!pageEl) throw new Error("Falha ao montar o relatório para Word.");

        pageEl.style.width = `${CONTENT_W}px`;
        pageEl.style.maxWidth = `${CONTENT_W}px`;
        pageEl.style.minWidth = `${CONTENT_W}px`;
        pageEl.style.margin = "0 auto";
        pageEl.style.background = "#ffffff";
        pageEl.style.display = "block";
        pageEl.style.boxSizing = "border-box";
        stage.style.width = `${CONTENT_W + 40}px`;
        stage.style.padding = "0 20px";
        stage.style.overflow = "visible";

        const svgEls = stage.querySelectorAll("svg");
        svgEls.forEach((svg) => {
          try {
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            let w = svg.getAttribute("width") || svg.clientWidth || svg.viewBox?.baseVal?.width || 64;
            let h = svg.getAttribute("height") || svg.clientHeight || svg.viewBox?.baseVal?.height || 64;
            w = parseFloat(w) || 64;
            h = parseFloat(h) || 64;
            svg.setAttribute("width", `${w}`);
            svg.setAttribute("height", `${h}`);
            svg.style.width = `${w}px`;
            svg.style.height = `${h}px`;
            svg.style.display = "block";
          } catch {}
        });

        const allImgs = stage.querySelectorAll("img");
        await Promise.all([...allImgs].map((img) =>
          img.complete ? Promise.resolve() :
          new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 1500); })
        ));

        if (document.fonts?.ready) {
          try { await document.fonts.ready; } catch {}
        }
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const finalHeight = Math.max(1123, pageEl.scrollHeight + 200);
        stage.style.height = `${finalHeight}px`;
        stage.style.visibility = "visible";
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const canvas = await window.html2canvas(pageEl, {
          scale: 2.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          letterRendering: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
          ignoreElements: (el) => el.tagName && el.tagName.toLowerCase() === "script",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.96);

        const wordHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>Relatório de Viagem — TRIP-${tripId}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: A4 portrait;
  margin: 15mm 18mm 15mm 18mm;
  mso-page-orientation: portrait;
  mso-header-margin: 12.7mm;
  mso-footer-margin: 12.7mm;
}
div.Section1 { page: Section1; }
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  font-family: "Calibri", "Arial", sans-serif;
}
.report-page-img {
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
</style>
</head>
<body>
<div class="Section1">
  <img class="report-page-img" src="${imgData}" alt="Relatório de Viagem" />
</div>
</body>
</html>`;

        const wordBlob = new Blob(["\ufeff", wordHTML], { type: "application/msword" });
        const url = URL.createObjectURL(wordBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `relatorio-viagem-${tripId}.doc`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        document.getElementById(stageId)?.remove();
        document.body.style.overflow = "";
        close();
      } catch (error) {
        console.error(error);
        showAlert(alertEl, error.message || "Não foi possível exportar o Word.");
        document.getElementById("word-render-stage")?.remove();
        document.body.style.overflow = "";
      }
    })();
  });

  modal.querySelector('[data-export="pdf"]').addEventListener("click", () => {
    if (typeof window.html2pdf !== "function") {
      showAlert(alertEl, "O exportador PDF ainda está carregando. Tente novamente.");
      return;
    }

    (async () => {
      try {
        let reportHTML;
        if (typeof reportBlob === "string") {
          reportHTML = reportBlob;
        } else if (reportBlob instanceof Blob || (reportBlob && typeof reportBlob.arrayBuffer === "function")) {
          const buf = await reportBlob.arrayBuffer();
          reportHTML = new TextDecoder("utf-8").decode(buf);
        } else if (reportBlob && reportBlob.byteLength !== undefined) {
          reportHTML = new TextDecoder("utf-8").decode(reportBlob);
        } else {
          reportHTML = String(reportBlob);
        }
        const A4_WIDTH_PX = 794;
        const MARGIN_MM = 14;
        const MARGIN_PX_LEFT_RIGHT = Math.round((MARGIN_MM / 25.4) * 96 * 2);
        const CONTENT_W = Math.max(680, A4_WIDTH_PX - MARGIN_PX_LEFT_RIGHT);

        const stage = document.createElement("div");
        stage.id = "pdf-render-stage";
        Object.assign(stage.style, {
          position: "absolute",
          left: "0",
          top: "0",
          width: `${CONTENT_W}px`,
          height: "auto",
          background: "#ffffff",
          zIndex: "999999",
          margin: "0",
          padding: "0",
          pointerEvents: "none",
          overflow: "visible",
          opacity: "0",
          visibility: "hidden",
          transform: "none",
        });
        document.body.appendChild(stage);
        document.body.style.overflow = "hidden";
        stage.innerHTML = reportHTML;
        const pageEl = stage.querySelector(".page");
        if (!pageEl) throw new Error("Falha ao montar o relatório para PDF.");

        pageEl.style.width = `${CONTENT_W}px`;
        pageEl.style.maxWidth = `${CONTENT_W}px`;
        pageEl.style.minWidth = `${CONTENT_W}px`;
        pageEl.style.margin = "0 auto";
        pageEl.style.background = "#ffffff";
        pageEl.style.display = "block";
        pageEl.style.boxSizing = "border-box";
        stage.style.width = `${CONTENT_W + 40}px`;
        stage.style.padding = "0 20px";
        stage.style.overflow = "visible";

        const svgEls = stage.querySelectorAll("svg");
        svgEls.forEach((svg) => {
          try {
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            let w = svg.getAttribute("width") || svg.clientWidth || svg.viewBox?.baseVal?.width || 64;
            let h = svg.getAttribute("height") || svg.clientHeight || svg.viewBox?.baseVal?.height || 64;
            w = parseFloat(w) || 64;
            h = parseFloat(h) || 64;
            svg.setAttribute("width", `${w}`);
            svg.setAttribute("height", `${h}`);
            svg.style.width = `${w}px`;
            svg.style.height = `${h}px`;
            svg.style.display = "block";
          } catch {}
        });

        const allImgs = stage.querySelectorAll("img");
        await Promise.all([...allImgs].map((img) =>
          img.complete ? Promise.resolve() :
          new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 1500); })
        ));

        if (document.fonts?.ready) {
          try { await document.fonts.ready; } catch {}
        }
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const finalHeight = Math.max(1123, pageEl.scrollHeight + 200);
        stage.style.height = `${finalHeight}px`;
        stage.style.visibility = "visible";
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        await window.html2pdf().set({
          margin: [MARGIN_MM, MARGIN_MM, MARGIN_MM, MARGIN_MM],
          filename: `relatorio-viagem-${tripId}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            letterRendering: true,
            logging: false,
            allowTaint: true,
            foreignObjectRendering: false,
            removeContainer: false,
            ignoreElements: (el) => el.tagName && el.tagName.toLowerCase() === "script",
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: {
            mode: ["css"],
            avoid: [".card", ".task-card", ".user-schedule-block", ".report-footer", ".signatures"],
          },
        }).from(pageEl).save();

        document.getElementById("pdf-render-stage")?.remove();
        document.body.style.overflow = "";
        close();
      } catch (error) {
        console.error(error);
        showAlert(alertEl, error.message || "Não foi possível exportar o PDF.");
        document.getElementById("pdf-render-stage")?.remove();
        document.body.style.overflow = "";
      }
    })();
  });
}

function setupLocationMonitor(trip) {
  if (!trip) return;
  if (trip.status !== 'in_progress') {
    return;
  }

  setLocationConsent(tripId, true);
  const consent = true;

  if (consent === true && !isMonitoringActive(tripId)) {
    startTripLocationMonitor(tripId, {
      intervalMs: 4 * 60 * 1000,
      loadTrip: () => api.getTrip(tripId).then((r) => r.trip),
      onTripEnded: () => {
        stopTripLocationMonitor(tripId, { notify: true, alertEl, showAlertFn: showAlert });
        updateLocationMonitorStatus(trip);
      },
    });
  }

  updateLocationMonitorStatus(trip);

  if (monitorMetricsTimer) clearInterval(monitorMetricsTimer);
  monitorMetricsTimer = setInterval(() => updateLocationMonitorStatus(trip), 15000);
}


function applyDemandCompletionOptimisticUpdate(trip, payload) {
  if (!trip || !payload || !payload.demanda_atividade_id) return trip;

  const nextTrip = JSON.parse(JSON.stringify(trip || {}));
  const atividadeId = Number(payload.demanda_atividade_id);
  const selectedResponsibleIds = Array.isArray(payload.responsible_ids)
    ? payload.responsible_ids.map(Number).filter(Boolean)
    : [];
  const selectedResponsibleNames = selectedResponsibleIds
    .map((id) => (nextTrip.members || []).find((member) => Number(member.user_id || member.id) === id)?.full_name)
    .filter(Boolean);
  const completionLabel = selectedResponsibleNames.length
    ? selectedResponsibleNames.join(', ')
    : window.__currentUser?.full_name || 'Você';
  let updated = false;

  for (const demanda of nextTrip.demandas || []) {
    for (const veiculo of demanda.veiculos || []) {
      for (const atividade of veiculo.atividades || []) {
        if (Number(atividade.id) !== atividadeId) continue;

        atividade.status = 'concluida';
        atividade.concluida_nome = completionLabel;
        atividade.concluida_em = new Date().toISOString();
        updated = true;

        const todas = (veiculo.atividades || []).map((item) => item.status);
        const concluidas = todas.filter((status) => status === 'concluida').length;
        const total = todas.length || 1;
        demanda.status = concluidas >= total ? 'concluida' : 'em_andamento';
      }
    }
  }

  if (updated) {
    const demandasContainer = document.getElementById("demandas-panel-container");
    if (demandasContainer) {
      renderQuadroDemandasIntegrante(demandasContainer, nextTrip.demandas || [], nextTrip.id, {
        user: window.__currentUser || null,
      });
    }
  }

  return nextTrip;
}

async function init() {
  if (!tripId) {
    window.location.href = "index.html";
    return;
  }
  const user = await mountShell({ active: "dashboard" });
  if (!user) return;
  window.__currentUser = user;

  try {
    const [res, typesRes] = await Promise.all([
      api.getTrip(tripId),
      api.workTypes({ trip_id: tripId }),
    ]);
    const trip = res.trip;
    fillWorkTypes(typesRes.work_types || []);
    renderTrip(trip);
    setupPanelToggles();

    setupLocationMonitor(trip);

    const editBtn = document.getElementById("btn-edit-trip");
    if (editBtn) {
      editBtn.textContent =
        trip.status === "completed" ? "Editar checklist" : "Editar viagem";
    }
    const reportBtn = document.getElementById("btn-trip-report");
    if (reportBtn) {
      const canReport = trip.status === "completed";
      reportBtn.disabled = !canReport;
      reportBtn.title = canReport
        ? "Abrir relatório da viagem"
        : "O relatório só pode ser gerado após a conclusão da viagem";
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }

  document.getElementById('btn-trip-history')?.addEventListener('click', () => {
    window.location.href = `trip-history.html?id=${tripId}`;
  });
  document.getElementById('btn-trip-report')?.addEventListener('click', () => {
    if (window.__currentTrip?.status !== "completed") return;
    try {
      if (typeof window.TripReport?.buildAndRender !== "function") {
        throw new Error("O renderizador de relatórios ainda está carregando. Tente novamente.");
      }
      const html = window.TripReport.buildAndRender(window.__currentTrip);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      showReportExportOptions(blob);
    } catch (error) {
      showAlert(alertEl, error.message || "Não foi possível gerar o relatório.");
    }
  });
}

document.getElementById("task-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(alertEl);
  const btn = document.getElementById("btn-save-task");
  if (btn) btn.disabled = true;

  try {
    const trip = window.__currentTrip;
    const payload = taskFormPayload();
    const personalConflict = hasPersonalTaskConflict(payload);
    const confirmedPersonalConflict = hasConfirmedPersonalTaskConflict(payload);
    const validation = validateTaskTimeAvailability(
      trip,
      payload.task_date,
      payload.start_time,
      payload.end_time,
      payload.responsible_ids,
      confirmedPersonalConflict,
    );

    if (!validation.ok) {
      showAlert(alertEl, validation.message);
      alertEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (
      personalConflict && !confirmedPersonalConflict
    ) {
      showAlert(
        alertEl,
        "Há sobreposição com uma tarefa sua. Confira o aviso abaixo e clique em 'Salvar mesmo assim' para prosseguir.",
        "warning",
      );
      alertEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    payload.allow_conflict = confirmedPersonalConflict;

    const res = await api.addTask(tripId, payload);
    const optimisticTrip = applyDemandCompletionOptimisticUpdate(window.__currentTrip, payload);
    if (optimisticTrip && optimisticTrip !== window.__currentTrip) {
      window.__currentTrip = optimisticTrip;
    }
    const freshTripRes = await api.getTrip(tripId);
    const freshTrip = applyDemandCompletionOptimisticUpdate(
      freshTripRes?.trip || optimisticTrip || res.trip,
      payload,
    );
    window.__currentTrip = freshTrip;
    renderTrip(freshTrip);
    setupPanelToggles();
    prepareTaskForm(freshTrip, { keepDate: true });
    showAlert(alertEl, "Tarefa salva com sucesso.", "success");

    const taskId = res.task_id || (freshTrip?.tasks || []).slice(-1)[0]?.id || null;
    if (taskId && getLocationConsent(tripId) === true) {
      registrarCheckinTrabalho(taskId, { viagemId: tripId, silent: true })
        .then((r) => {
          if (r.ok) updateLocationMonitorStatus(res.trip || window.__currentTrip);
        })
        .catch(() => {});
    }

  } catch (err) {
    showAlert(alertEl, err.message);
    alertEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById("btn-complete")?.addEventListener("click", async () => {
  hideAlert(alertEl);
  const trip = window.__currentTrip;
  const valid = hasTaskEveryTripDay(trip);
  const confirmed = await confirmDialog({
    title: "Finalizar viagem",
    message: valid
      ? ""
      : "Só é possível finalizar quando cada dia do período tiver pelo menos uma tarefa registrada.",
    confirmLabel: "Finalizar",
    cancelLabel: "Cancelar",
    tone: valid ? "confirm" : "danger",
    confirmTone: valid ? "primary" : "danger",
  });
  if (!confirmed) return;
  try {
    stopTripLocationMonitor(tripId, { notify: false });
    const res = await api.completeTrip(tripId);
    renderTrip(res.trip);
    setupPanelToggles();
    showAlert(
      alertEl,
      "Viagem finalizada com sucesso! Compartilhamento de localização encerrado.",
      "success",
    );
    updateLocationMonitorStatus(res.trip);
    if (monitorMetricsTimer) {
      clearInterval(monitorMetricsTimer);
      monitorMetricsTimer = null;
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
});

document.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest("[data-del-task]");
  if (!deleteBtn) return;

  const id = deleteBtn.getAttribute("data-del-task");
  if (!id) return;

  const confirmed = await confirmDialog({
    title: "Excluir tarefa",
    message:
      "Deseja realmente excluir esta tarefa? Esta ação não pode ser desfeita.",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    tone: "danger",
    confirmTone: "danger",
  });

  if (!confirmed) return;

  hideAlert(alertEl);
  try {
    const res = await api.deleteTask(tripId, id);
    renderTrip(res.trip);
    showAlert(alertEl, "Tarefa excluída.", "success");
  } catch (err) {
    showAlert(alertEl, err.message);
  }
});

document.getElementById("btn-edit-trip")?.addEventListener("click", () => {
  const trip = window.__currentTrip;
  if (!trip) return;
  if (trip.status === "completed") {
    document
      .getElementById("task-form-wrap")
      ?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  window.location.href = `trip-new.html?id=${tripId}`;
});

document
  .getElementById("btn-delete-trip")
  ?.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Excluir viagem",
      message: "Deseja excluir esta viagem? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
      confirmTone: "danger",
    });

    if (!confirmed) return;

    hideAlert(alertEl);
    try {
      await api.deleteTrip(tripId);
      showAlert(alertEl, "Viagem excluída com sucesso.", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    } catch (err) {
      showAlert(alertEl, err.message);
    }
  });

init();