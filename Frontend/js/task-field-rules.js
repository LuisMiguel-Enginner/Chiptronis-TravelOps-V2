export function normalizeWorkType(type) {
  return String(type || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeFieldName(fieldName) {
  return String(fieldName || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function isTravelType(type) {
  return normalizeWorkType(type) === "viagem";
}

export function isLunchType(type) {
  return normalizeWorkType(type) === "refeicao";
}

<<<<<<< HEAD
export function shouldShowVehicleFields(type) {
  return !isTravelType(type) && !isLunchType(type);
=======
export function filterWorkTypesForProject(types = [], projectName = "") {
  const selectedProject = normalizeWorkType(projectName);
  const isDiversos = selectedProject === "diversos";

  return (Array.isArray(types) ? types : []).filter((type) => {
    const normalized = normalizeWorkType(type);
    if (isDiversos) return true;

    return normalized !== "refeicao" && normalized !== "viagem";
  });
}

const NO_VEHICLE_WORK_TYPES = new Set([
  "almoco",
  "refeicao",
  "viagem",
  "deslocamento",
  "analise de veiculos",
  "visita",
  "acompanhamento",
]);

export function shouldShowVehicleFields(type) {
  return !NO_VEHICLE_WORK_TYPES.has(normalizeWorkType(type));
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
}

export function shouldShowVehicleDetailFields(type) {
  return shouldShowVehicleFields(type);
}

const BUILT_IN_VEHICLE_FIELD_NAMES = new Set([
  "montadora",
  "modelo",
  "submodelo",
  "versao modelo",
  "versao_modelo",
  "placa",
  "ano",
  "veiculo",
  "vehicle",
]);

export function filterVehicleDetailCustomFields(fields = []) {
  return (Array.isArray(fields) ? fields : []).filter((field) => {
    const name = normalizeFieldName(
      field?.field_name || field?.name || field?.label || "",
    );
    return !BUILT_IN_VEHICLE_FIELD_NAMES.has(name);
  });
}
