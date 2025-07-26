// Simple React App for Chrome Extension
import React from 'react';
import ReactDOM from 'react-dom/client';
import ChromeSidebar from '../components/ChromeSidebar.jsx';

// Create root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the ChromeSidebar component
root.render(
  React.createElement(ChromeSidebar)
);

console.log('Chrome Extension loaded successfully!'); 