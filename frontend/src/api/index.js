import axios from 'axios'
import client from './client'

// ── Auth ────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  axios.post('/api/auth/login/', { username, password })

export const register = (username, password, email) =>
  axios.post('/api/auth/register/', { username, password, email })

export const getMe = () => client.get('/auth/me/')

// ── Dashboard ───────────────────────────────────────────────────────────
export const getDashboardSummary = () => client.get('/dashboard/')

// ── Patients ────────────────────────────────────────────────────────────
export const getPatients = (params = {}) => client.get('/patients/', { params })
export const getPatient = (id) => client.get(`/patients/${id}/`)
export const createPatient = (data) => client.post('/patients/', data)
export const updatePatient = (id, data) => client.put(`/patients/${id}/`, data)
export const deletePatient = (id) => client.delete(`/patients/${id}/`)

// ── Medical Records ─────────────────────────────────────────────────────
export const getRecords = (params = {}) => client.get('/records/', { params })
export const createRecord = (data) => client.post('/records/', data)

// ── Analysis Results ────────────────────────────────────────────────────
export const getAnalyses = (params = {}) => client.get('/analyses/', { params })

// ── ETL Upload only ─────────────────────────────────────────────────────
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

// ── ETL + ML Analyse ────────────────────────────────────────────────────
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

// ── ML Predict ──────────────────────────────────────────────────────────
export const predict = (rows) => client.post('/predict/', { rows })

// ── Batch Reports ───────────────────────────────────────────────────────
export const getReports = () => client.get('/reports/')
export const getReport = (id) => client.get(`/reports/${id}/`)
export const getReportDetail = (id) => client.get(`/reports/${id}/`)
export const getPatientAnalyses = (id) => client.get(`/patients/${id}/analyses/`)

export const analysePatient = (id) => client.post(`/patients/${id}/analyse/`)

export const deleteReport = (id) => client.delete(`/reports/${id}/`)