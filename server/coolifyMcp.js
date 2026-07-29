import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const COOLIFY_API_URL = process.env.COOLIFY_API_URL || 'http://localhost:8000';
const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN || '';

const coolifyClient = axios.create({
  baseURL: `${COOLIFY_API_URL}/api/v1`,
  headers: {
    Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// List Applications
app.get('/mcp/coolify/applications', async (req, res) => {
  try {
    const response = await coolifyClient.get('/applications');
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

// Trigger Deployment
app.post('/mcp/coolify/deploy', async (req, res) => {
  const { uuid, force } = req.body;
  try {
    const response = await coolifyClient.post(`/deploy?uuid=${uuid}&force=${force || false}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

// Get Application Details
app.get('/mcp/coolify/applications/:uuid', async (req, res) => {
  try {
    const response = await coolifyClient.get(`/applications/${req.params.uuid}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

// Restart Application
app.post('/mcp/coolify/applications/:uuid/restart', async (req, res) => {
  try {
    const response = await coolifyClient.post(`/applications/${req.params.uuid}/restart`);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

export default app;
