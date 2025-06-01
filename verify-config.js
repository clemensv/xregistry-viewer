#!/usr/bin/env node

/**
 * Configuration Verification Script
 *
 * This script helps verify that the xRegistry viewer application's
 * configuration loading is working correctly. It checks:
 *
 * 1. If the config.json file is accessible
 * 2. If the config.json file contains all required fields
 * 3. If the application can properly load the configuration
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:4200';
const CONFIG_URL = `${APP_URL}/config.json`;
// Use curl for more reliable network requests if available
const USE_CURL = hasCommand('curl');
const TIMEOUT_MS = 5000;
const RETRY_COUNT = 3;
const CONFIG_PATH = path.resolve(__dirname, 'public', 'config.json');
const REQUIRED_FIELDS = ['apiEndpoints', 'baseUrl', 'features'];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Helper function to make an HTTP request
function makeRequest(url, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

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

    req.on('timeout', () => {
      req.abort();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    req.end();
  });
}

// Check if the local config.json file exists
function checkLocalConfig() {
  console.log(`${colors.blue}Checking local configuration file...${colors.reset}`);

  try {
    const configExists = fs.existsSync(CONFIG_PATH);

    if (!configExists) {
      console.error(`${colors.red}Error: Local config file not found at ${CONFIG_PATH}${colors.reset}`);
      return false;
    }

    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    let config;

    try {
      config = JSON.parse(configContent);
      console.log(`${colors.green}✓ Local config file parsed successfully${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error parsing local config file: ${error.message}${colors.reset}`);
      return false;
    }

    // Check required fields
    const missingFields = REQUIRED_FIELDS.filter(field => !config[field]);

    if (missingFields.length > 0) {
      console.warn(`${colors.yellow}Warning: Missing required fields in local config: ${missingFields.join(', ')}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ All required fields present in local config${colors.reset}`);
    }

    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking local config: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check if the deployed config.json is accessible
async function checkDeployedConfig(retries = RETRY_COUNT) {
  console.log(`${colors.blue}Checking deployed configuration at ${CONFIG_URL}...${colors.reset}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use curl if available (more reliable), otherwise use the built-in http module
      const response = USE_CURL ?
        await makeRequestWithCurl(CONFIG_URL) :
        await makeRequest(CONFIG_URL);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const config = response.json();
      console.log(`${colors.green}✓ Remote config loaded successfully${colors.reset}`);

      // Check required fields
      const missingFields = REQUIRED_FIELDS.filter(field => !config[field]);

      if (missingFields.length > 0) {
        console.warn(`${colors.yellow}Warning: Missing required fields in remote config: ${missingFields.join(', ')}${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ All required fields present in remote config${colors.reset}`);
      }

      return true;
    } catch (error) {
      console.error(`${colors.red}Attempt ${attempt}/${retries} failed: ${error.message}${colors.reset}`);

      if (attempt < retries) {
        console.log(`${colors.yellow}Retrying in 1 second...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error(`${colors.red}Failed to load remote configuration after ${retries} attempts${colors.reset}`);
        return false;
      }
    }
  }

  return false;
}

// Main function
async function main() {
  console.log(`${colors.blue}xRegistry Configuration Verification${colors.reset}`);
  console.log('=================================');

  const localSuccess = checkLocalConfig();
  const remoteSuccess = await checkDeployedConfig();

  console.log('=================================');

  if (localSuccess && remoteSuccess) {
    console.log(`${colors.green}✓ Configuration check passed! The application should be able to load configuration correctly.${colors.reset}`);
    process.exit(0);
  } else {
    console.error(`${colors.red}✖ Configuration check failed! Please fix the issues above.${colors.reset}`);
    process.exit(1);
  }
}

// Utility function to check if a command exists
function hasCommand(command) {
  try {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });
    return result.status === 0;
  } catch (error) {
    return false;
  }
}

// Using curl as an alternative to the built-in http module
function makeRequestWithCurl(url) {
  return new Promise((resolve, reject) => {
    try {
      // -s: silent, -L: follow redirects, -f: fail on server errors
      const result = spawnSync('curl', ['-s', '-L', '-f', url], {
        encoding: 'utf8',
        shell: process.platform === 'win32'
      });

      if (result.status !== 0) {
        reject(new Error(`Curl failed with status ${result.status}: ${result.stderr}`));
        return;
      }

      try {
        const data = result.stdout;
        const json = JSON.parse(data);
        resolve({
          ok: true,
          status: 200,
          json: () => json,
          text: () => data
        });
      } catch (parseError) {
        reject(new Error(`Failed to parse JSON: ${parseError.message}`));
      }
    } catch (error) {
      reject(new Error(`Curl execution failed: ${error.message}`));
    }
  });
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  process.exit(1);
});
