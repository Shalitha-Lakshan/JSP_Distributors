const fs = require('fs');
const path = require('path');

const logoPath = path.resolve(__dirname, '../mobile/assets/logo.png');
const outDir = path.resolve(__dirname, '../mobile/src/assets');
const outPath = path.join(outDir, 'logoBase64.ts');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const base64 = fs.readFileSync(logoPath, 'base64');
const tsContent = `// Auto-generated Base64 Data URI for JSP Distributors Logo
export const JSP_LOGO_BASE64 = "data:image/png;base64,${base64}";
`;

fs.writeFileSync(outPath, tsContent, 'utf8');
console.log('Successfully generated logoBase64.ts. File size:', fs.statSync(outPath).size);
