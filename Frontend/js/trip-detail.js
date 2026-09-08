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

  const modal = document.createElement("div");
  modal.id = "report-export-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="report-export-title">
      <div class="modal-head">
        <div class="modal-icon info">↓</div>
        <div>
          <h3 id="report-export-title" class="modal-title">Exportar relatório</h3>
          <p class="modal-text">Escolha o formato para salvar o relatório da viagem.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-export="word">Exportar Word</button>
        <button type="button" class="btn btn-primary" data-export="pdf">Exportar PDF</button>
        <button type="button" class="btn btn-secondary" data-export="cancel">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('[data-export="cancel"]').addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  modal.querySelector('[data-export="word"]').addEventListener("click", () => {
    const wordBlob = new Blob([reportBlob], { type: "application/msword" });
    const url = URL.createObjectURL(wordBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-viagem-${tripId}.doc`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    close();
  });

  modal.querySelector('[data-export="pdf"]').addEventListener("click", () => {
    if (typeof window.html2pdf !== "function") {
      showAlert(alertEl, "O exportador PDF ainda está carregando. Tente novamente.");
      return;
    }

    const reportUrl = URL.createObjectURL(reportBlob);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-100000px";
    frame.style.top = "0";
    frame.style.width = "794px";
    frame.style.height = "1123px";
    frame.style.border = "0";
    document.body.appendChild(frame);

    frame.onload = async () => {
      try {
        const reportDocument = frame.contentDocument;
        const reportPage = reportDocument?.querySelector(".page");
        if (!reportPage || !reportPage.innerHTML.trim()) {
          throw new Error("O conteúdo do relatório não foi renderizado.");
        }
        frame.style.height = `${Math.max(1123, reportPage.scrollHeight + 20)}px`;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await window.html2pdf().set({
          margin: 0,
          filename: `relatorio-viagem-${tripId}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        }).from(reportPage).save();
        close();
      } catch (error) {
        showAlert(alertEl, error.message || "Não foi possível exportar o PDF.");
      } finally {
        URL.revokeObjectURL(reportUrl);
        frame.remove();
      }
    };
    frame.src = reportUrl;
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
    api.fetchTripReport(tripId)
      .then((blob) => {
        showReportExportOptions(blob);
      })
      .catch((error) => {
        showAlert(alertEl, error.message || "Não foi possível gerar o relatório.");
      });
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
