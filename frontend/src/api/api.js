import axios from 'axios';

// Since you are on Web, we simply use localhost
const API_URL = 'http://localhost:5001/api'; 

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;