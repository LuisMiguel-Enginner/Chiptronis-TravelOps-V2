import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowVehicleFields,
  shouldShowVehicleDetailFields,
  filterVehicleDetailCustomFields,
<<<<<<< HEAD
} from './task-field-rules.js';

test('vehicle detail fields should be shown for most work types', () => {
  assert.equal(shouldShowVehicleDetailFields('Visita técnica'), true);
  assert.equal(shouldShowVehicleDetailFields('Manutenção'), true);
  assert.equal(shouldShowVehicleDetailFields('Análise de veículos'), true);
=======
  filterWorkTypesForProject,
} from './task-field-rules.js';

test('vehicle detail fields should be hidden for the no-vehicle work types', () => {
  assert.equal(shouldShowVehicleDetailFields('Visita'), false);
  assert.equal(shouldShowVehicleDetailFields('Acompanhamento'), false);
  assert.equal(shouldShowVehicleDetailFields('Manutenção'), true);
  assert.equal(shouldShowVehicleDetailFields('Análise de veículos'), false);
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
});

test('vehicle detail fields should stay hidden for travel and meal types', () => {
  assert.equal(shouldShowVehicleDetailFields('Viagem'), false);
  assert.equal(shouldShowVehicleDetailFields('Refeição'), false);
  assert.equal(shouldShowVehicleDetailFields('refeicao'), false);
});

<<<<<<< HEAD
test('basic vehicle fields can still appear for analysis of vehicles', () => {
  assert.equal(shouldShowVehicleFields('Análise de veículos'), true);
  assert.equal(shouldShowVehicleFields('Viagem'), false);
  assert.equal(shouldShowVehicleFields('Refeição'), false);
=======
test('basic vehicle fields stay hidden for the no-vehicle work types', () => {
  assert.equal(shouldShowVehicleFields('Análise de veículos'), false);
  assert.equal(shouldShowVehicleFields('Viagem'), false);
  assert.equal(shouldShowVehicleFields('Refeição'), false);
  assert.equal(shouldShowVehicleFields('Almoço'), false);
  assert.equal(shouldShowVehicleFields('Deslocamento'), false);
});

test('work types should exclude meal and travel options for projects other than Diversos', () => {
  const types = ['Refeição', 'Viagem', 'Manutenção', 'Acompanhamento'];

  assert.deepEqual(
    filterWorkTypesForProject(types, 'SPB - Segundo Ponto Can'),
    ['Manutenção', 'Acompanhamento'],
  );
  assert.deepEqual(
    filterWorkTypesForProject(types, 'Diversos'),
    ['Refeição', 'Viagem', 'Manutenção', 'Acompanhamento'],
  );
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
});

test('custom fields for standard vehicle info are filtered out to avoid duplication', () => {
  const fields = [
    { field_name: 'Montadora' },
    { field_name: 'Modelo' },
    { field_name: 'Versão Modelo' },
    { field_name: 'Placa' },
    { field_name: 'Ano' },
    { field_name: 'Observação' },
  ];

  const filtered = filterVehicleDetailCustomFields(fields);

  assert.deepEqual(filtered.map((field) => field.field_name), ['Observação']);
});
