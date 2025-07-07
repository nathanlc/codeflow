import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

// This service is kept for future LSP/Tree-sitter integration
// Currently using FileService for real file loading

class CodeAnalysisService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });
  }

  async analyzeCode(code, language = 'javascript') {
    try {
      const response = await this.api.post('/api/analyze', { code, language });
      return response.data;
    } catch (error) {
      console.error('Error analyzing code:', error);
      throw error;
    }
  }

  async goToDefinition(symbol, file, position) {
    try {
      const response = await this.api.post('/api/goto-definition', {
        symbol,
        file,
        position,
      });
      return response.data;
    } catch (error) {
      console.error('Error getting definition:', error);
      throw error;
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage) {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('Connected to CodeFlow backend');
    };

    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      if (onMessage) {
        onMessage(data);
      }
    };

    ws.onerror = error => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }
}

export default new CodeAnalysisService();
