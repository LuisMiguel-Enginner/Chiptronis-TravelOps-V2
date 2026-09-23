export function normalizeVehicleField(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizePlate(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function vehicleIdentity(vehicle = {}) {
  return [
    normalizeVehicleField(vehicle.montadora),
    normalizeVehicleField(vehicle.modelo),
    normalizeVehicleField(vehicle.versao_modelo ?? vehicle.submodelo),
    normalizeVehicleField(vehicle.ano),
    normalizePlate(vehicle.placa ?? vehicle.plate),
  ].join('|');
}

export function vehicleFieldsMatch(left = {}, right = {}, { allowMissingPlate = false } = {}) {
  const coreFields = ['montadora', 'modelo', 'versao_modelo', 'ano'];
  const sameCore = coreFields.every((field) => {
    const leftValue = field === 'versao_modelo' ? left.versao_modelo ?? left.submodelo : left[field];
    const rightValue = field === 'versao_modelo' ? right.versao_modelo ?? right.submodelo : right[field];
    return normalizeVehicleField(leftValue) === normalizeVehicleField(rightValue);
  });
  if (!sameCore) return false;

  const leftPlate = normalizePlate(left.placa ?? left.plate);
  const rightPlate = normalizePlate(right.placa ?? right.plate);
  return allowMissingPlate && (!leftPlate || !rightPlate) ? true : leftPlate === rightPlate;
}