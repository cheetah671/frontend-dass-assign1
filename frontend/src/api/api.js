import axios from 'axios';

// Since you are on Web, we simply use localhost
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';


const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;