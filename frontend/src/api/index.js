import client from './client'


export const login = (username, password) =>
  client.post('/auth/login/', { username, password })

export const register = (username, password, email) =>
  client.post('/auth/register/', { username, password, email })

export const getMe = () => client.get('/auth/me/')

export const changePassword = (current_password, new_password, confirm_password) =>
  client.post('/auth/change-password/', { current_password, new_password, confirm_password })


export const getDashboardSummary = (days) => client.get('/dashboard/', { params: days ? { days } : {} })


export const getPatients = (params = {}) => client.get('/patients/', { params })
export const getAllPatients = (params = {}) =>
  client.get('/patients/', { params: { ...params, page_size: 10000 } })
export const getPatient = (id) => client.get(`/patients/${id}/`)
export const createPatient = (data) => client.post('/patients/', data)
export const updatePatient = (id, data) => client.put(`/patients/${id}/`, data)
export const deletePatient = (id) => client.delete(`/patients/${id}/`)


export const getRecords = (params = {}) => client.get('/records/', { params })
export const createRecord = (data) => client.post('/records/', data)


export const getAnalyses = (params = {}) => client.get('/analyses/', { params })


export const uploadDataset = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
}


export const analyseDataset = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/analyse/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
}


export const predict = (rows) => client.post('/predict/', { rows })


export const getReports = () => client.get('/reports/')
export const getReport = (id) => client.get(`/reports/${id}/`)
export const getReportDetail = (id) => client.get(`/reports/${id}/`)
export const getPatientAnalyses = (id) => client.get(`/patients/${id}/analyses/`)
export const analysePatient = (id) => client.post(`/patients/${id}/analyse/`)
export const deleteReport = (id) => client.delete(`/reports/${id}/`)
export const bulkDeletePatients = (ids) => client.delete('/patients/bulk-delete/', { data: { ids } })