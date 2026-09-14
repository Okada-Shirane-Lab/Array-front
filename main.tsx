import {createRoot} from 'react-dom/client';
import GameClient from './app/game-client';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<GameClient/>);
