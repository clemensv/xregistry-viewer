const https = require('https');

// Test loading the model from packages.mcpxreg.com
console.log('Testing packages.mcpxreg.com model endpoint...\n');

https.get('https://packages.mcpxreg.com/model', (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log('');

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const model = JSON.parse(data);
      console.log('✓ Successfully parsed JSON model');
      console.log(`Model specversion: ${model.specversion}`);
      console.log(`Model registryid: ${model.registryid}`);
      console.log(`Model name: ${model.name}`);
      console.log(`Model description: ${model.description}`);
      console.log('');

      if (model.groups) {
        console.log('Available group types:');
        Object.keys(model.groups).forEach(groupType => {
          const group = model.groups[groupType];
          console.log(`  - ${groupType}: ${group.description || 'No description'}`);
          if (group.resources) {
            Object.keys(group.resources).forEach(resourceType => {
              const resource = group.resources[resourceType];
              console.log(`    └─ ${resourceType}: ${resource.description || 'No description'}`);
            });
          }
        });
      } else {
        console.log('❌ No groups found in model');
      }

      console.log('\n--- Full Model Structure ---');
      console.log(JSON.stringify(model, null, 2));

    } catch (error) {
      console.error('❌ Failed to parse JSON:', error.message);
      console.log('Raw response:', data.substring(0, 500) + '...');
    }
  });

}).on('error', (err) => {
  console.error('❌ Request failed:', err.message);
});
