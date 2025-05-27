const https = require('https');

// Test what keys exist in packages.mcpxreg.com model
console.log('Checking top-level keys in packages.mcpxreg.com model...\n');

https.get('https://packages.mcpxreg.com/model', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const model = JSON.parse(data);
      console.log('Top-level keys in model:', Object.keys(model));
      console.log('');
      console.log('Model structure:');
      Object.keys(model).forEach(key => {
        console.log(`  ${key}: ${typeof model[key]}`);
        if (typeof model[key] === 'string') {
          console.log(`    Value: "${model[key]}"`);
        } else if (typeof model[key] === 'object' && model[key] !== null) {
          console.log(`    Keys: [${Object.keys(model[key]).join(', ')}]`);
        }
      });

      // Check if this is a complete RegistryModel
      const requiredKeys = ['specversion', 'registryid', 'name', 'description', 'capabilities', 'groups'];
      console.log('\nRequired RegistryModel keys:');
      requiredKeys.forEach(key => {
        const exists = model.hasOwnProperty(key);
        console.log(`  ${key}: ${exists ? '✓ present' : '❌ missing'}`);
      });

    } catch (error) {
      console.error('❌ Failed to parse JSON:', error.message);
    }
  });

}).on('error', (err) => {
  console.error('❌ Request failed:', err.message);
});
