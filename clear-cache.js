// Cache clearing script to add to browser console
// Execute this in the browser console to clear the ModelService cache

console.log('Clearing ModelService cache...');

// Try to access Angular application
if (typeof ng !== 'undefined') {
  const appRef = ng.getComponent(document.querySelector('app-root'));
  if (appRef) {
    const injector = appRef.injector || appRef.constructor.ɵinj;
    if (injector) {
      const modelService = injector.get('ModelService');
      if (modelService) {
        modelService.clearAllCaches();
        console.log('✓ ModelService cache cleared');
      } else {
        console.log('❌ ModelService not found');
      }
    } else {
      console.log('❌ Injector not found');
    }
  } else {
    console.log('❌ App component not found');
  }
} else {
  console.log('❌ ng not available');
}

// Alternative: Clear localStorage and sessionStorage
localStorage.clear();
sessionStorage.clear();
console.log('✓ Browser storage cleared');

// Reload the page to force fresh model loading
console.log('Reloading page to force fresh model loading...');
setTimeout(() => location.reload(), 1000);
