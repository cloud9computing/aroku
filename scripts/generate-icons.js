// Generate icon files for PWA
import fs from 'fs';
import path from 'path';

const publicIconsDir = path.resolve('public/icons');
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
}

// Write SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="#FBFAF6" />
  <circle cx="256" cy="256" r="210" fill="#F1EEE6" />
  <path d="M256 120 C180 120 120 180 120 256 C120 332 180 392 256 392 C332 392 392 332 392 256" fill="none" stroke="#8A6352" stroke-width="32" stroke-linecap="round"/>
  <circle cx="392" cy="256" r="28" fill="#6B7E5C" />
  <path d="M220 256 H292 M256 220 V292" stroke="#8A6352" stroke-width="24" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(publicIconsDir, 'icon.svg'), svgContent);
console.log('Icons generated successfully.');
