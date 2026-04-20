import api from '../../config/api';

export async function listAcademyModels() {
  const response = await api.get('/academy-processes/models');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createAcademyModel(payload) {
  const response = await api.post('/academy-processes/models', payload);
  return response.data;
}

export async function updateAcademyModel(id, payload) {
  const response = await api.put(`/academy-processes/models/${id}`, payload);
  return response.data;
}

export async function listGeneratedProcesses() {
  const response = await api.get('/academy-processes/generated');
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateGeneratedProcess(id, payload) {
  const response = await api.put(`/academy-processes/generated/${id}`, payload);
  return response.data;
}

export async function deleteGeneratedProcess(id) {
  const response = await api.delete(`/academy-processes/generated/${id}`);
  return response.data;
}

export async function deleteAcademyModel(id) {
  const response = await api.delete(`/academy-processes/models/${id}`);
  return response.data;
}

export async function generateProcessesBatch(items) {
  const response = await api.post('/academy-processes/generate', { items });
  return response.data;
}

export async function getGeneratedCalendar(month, year) {
  const response = await api.get('/academy-processes/calendar', {
    params: { mes: month, ano: year },
  });
  return response.data || {};
}
