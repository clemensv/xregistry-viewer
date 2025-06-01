// Node.js script to test both the application and config loading
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Variables
const APP_URL = 'http://localhost:4200';
const CONFIG_URL = `${APP_URL}/config.json`;
const TIMEOUT_MS = 10000;

// Helper function to make an HTTP request
function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // The whole response has been received
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: () => JSON.parse(data),
          text: () => Promise.resolve(data)
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    // End the request
    req.end();
  });
}

// Helper function to wait for a server to be responsive
function waitForServer(url, retries = 10, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const attempt = () => {
      attempts++;
      console.log(`Attempt ${attempts}/${retries} to connect to ${url}`);
      
      makeHttpRequest(url)
        .then(res => {
          if (res.ok) {
            console.log(`Server at ${url} is responsive!`);
            resolve(res);
          } else {
            throw new Error(`Server response not OK: ${res.status}`);
          }
        })
        .catch(err => {
          if (attempts >= retries) {
            console.error(`Failed to connect after ${retries} attempts:`, err);
            reject(err);
            return;
          }
          
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(attempt, delay);
        });
    };
    
    attempt();
  });
}

// Main test function
async function runTests() {
  try {
    console.log('Starting application configuration tests...');
    
    // Step 1: Check if the server is running
    console.log('\n--- Step 1: Checking if the application server is running ---');
    await waitForServer(APP_URL);
    
    // Step 2: Check if config.json is accessible
    console.log('\n--- Step 2: Checking if config.json is accessible ---');
    const configResponse = await makeHttpRequest(CONFIG_URL);
    
    if (!configResponse.ok) {
      throw new Error(`Failed to access config.json: ${configResponse.status}`);
    }
    
    console.log('Config.json is accessible:', configResponse.ok);
    console.log('Content type:', configResponse.headers['content-type']);
    
    // Step 3: Parse the config
    console.log('\n--- Step 3: Parsing the config.json content ---');
    const config = configResponse.json();
    console.log('Config loaded successfully:');
    console.log(JSON.stringify(config, null, 2));
    
    // Make sure required fields are present
    const requiredFields = ['apiEndpoints', 'baseUrl', 'features'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      console.error('Warning: Missing required fields in config:', missingFields);
    } else {
      console.log('All required fields are present in the config');
    }
    
    console.log('\nAll tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();
