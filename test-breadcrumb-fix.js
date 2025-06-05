// Quick test to validate breadcrumb name resolution logic
// This simulates the fix we implemented

function testBreadcrumbNameResolution() {
  console.log('Testing breadcrumb name resolution fix...\n');

  // Test cases simulating different API responses
  const testCases = [
    {
      name: 'Case 1: API returns file name',
      urlSegment: 'aem',
      apiResponse: { name: 'openapi.yaml', id: 'openapi.yaml' },
      expectedLabel: 'aem'
    },
    {
      name: 'Case 2: API returns meaningful name',
      urlSegment: 'user-service',
      apiResponse: { name: 'User Management Service', id: 'user-service' },
      expectedLabel: 'User Management Service'
    },
    {
      name: 'Case 3: API returns JSON file name',
      urlSegment: 'payment-api',
      apiResponse: { name: 'swagger.json', id: 'payment-api' },
      expectedLabel: 'payment-api'
    },
    {
      name: 'Case 4: No API response name',
      urlSegment: 'auth-api',
      apiResponse: { id: 'auth-api' },
      expectedLabel: 'auth-api'
    }
  ];

  // Implementation of our fix logic
  function getBreadcrumbLabel(urlSegment, apiResponse) {
    let label = urlSegment; // Default to URL segment

    // Only use API name if it's different from common file extensions
    // and doesn't contain file extensions
    if (apiResponse.name &&
        apiResponse.name !== urlSegment &&
        !apiResponse.name.includes('.yaml') &&
        !apiResponse.name.includes('.json') &&
        !apiResponse.name.includes('.xml') &&
        !apiResponse.name.includes('.html')) {
      label = apiResponse.name;
    }

    return label;
  }

  // Run tests
  testCases.forEach(testCase => {
    const result = getBreadcrumbLabel(testCase.urlSegment, testCase.apiResponse);
    const passed = result === testCase.expectedLabel;

    console.log(`${testCase.name}:`);
    console.log(`  URL Segment: ${testCase.urlSegment}`);
    console.log(`  API Response: ${JSON.stringify(testCase.apiResponse)}`);
    console.log(`  Expected: ${testCase.expectedLabel}`);
    console.log(`  Actual: ${result}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  });
}

testBreadcrumbNameResolution();
