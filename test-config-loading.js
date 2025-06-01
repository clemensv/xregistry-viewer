// Enhanced test script to verify configuration loading
console.log('Starting config loading test...');

// First test: Check if config.json exists and is accessible
console.log('Test 1: Checking if config.json exists with HEAD request...');
fetch('http://localhost:4200/config.json', { method: 'HEAD' })
  .then(response => {
    console.log('HEAD request status:', response.status);
    console.log('HEAD request ok:', response.ok);
    console.log('Content type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`Config file not accessible: ${response.status}`);
    }

    runConfigTest();
  })
  .catch(error => {
    console.error('Error checking config file:', error);
    console.log('Continuing with GET request anyway...');
    runConfigTest();
  });

// Second test: Actually fetch the config.json content
function runConfigTest() {
  console.log('Test 2: Fetching config.json content...');
  fetch('http://localhost:4200/config.json')
    .then(response => {
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      return response.json();
    })
    .then(config => {
      console.log('Configuration loaded successfully:', config);
      console.log('API Endpoints count:', config.apiEndpoints?.length || 0);
      console.log('Model URIs count:', config.modelUris?.length || 0);
      console.log('Base URL:', config.baseUrl);
      console.log('Features:', config.features);
      console.log('Test passed: Configuration loading successful');
    })
    .catch(error => {
      console.error('Error loading configuration:', error);
      console.log('Test failed: Configuration loading error');
    });
}

// Third test: Try to access assets/config.json as fallback
console.log('Test 3: Checking fallback location assets/config.json...');
fetch('http://localhost:4200/assets/config.json')
  .then(response => {
    console.log('Fallback status:', response.status);
    console.log('Fallback available:', response.ok);
    if (response.ok) {
      return response.json().then(config => {
        console.log('Fallback config available:', config);
      });
    }
  })
  .catch(error => {
    console.error('Fallback not available:', error);
  });
