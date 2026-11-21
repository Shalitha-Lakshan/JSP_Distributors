const https = require('https');

https.get('https://jsp-distributors.onrender.com/api/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Is Array:', Array.isArray(json));
      if (Array.isArray(json)) {
        console.log('First 2 products:');
        console.log(JSON.stringify(json.slice(0, 2), null, 2));
        const aud = json.find(p => p.itemCode === 'AUD-B-0104');
        console.log('AUD-B-0104:', aud);
      } else {
        console.log('Response:', json);
      }
    } catch(e) {
      console.log('Raw data:', data.slice(0, 500));
    }
  });
}).on('error', err => {
  console.error('Error:', err.message);
});

