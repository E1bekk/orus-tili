import { createRoot } from 'react-dom/client';
import App from './App';
import { initTelegram } from './lib/tg';
import './styles.css';

initTelegram();
createRoot(document.getElementById('root')).render(<App />);
