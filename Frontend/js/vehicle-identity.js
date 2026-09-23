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
