import { Injectable } from '@angular/core';
import hljs from 'highlight.js';

@Injectable({
  providedIn: 'root'
})
export class HighlightService {

  constructor() {
    // Optionally register specific languages to reduce bundle size
    hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
    hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'));
    hljs.registerLanguage('yaml', require('highlight.js/lib/languages/yaml'));
  }

  highlightElement(element: HTMLElement) {
    hljs.highlightElement(element);
  }

  highlightCode(code: string, language?: string): string {
    if (language) {
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch (e) {
        console.warn(`Highlight.js language '${language}' not registered. Falling back to auto-detection.`, e);
        // Fall through to auto-detection if specific language highlighting fails
      }
    }
    return hljs.highlightAuto(code).value;
  }

  isJson(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  formatJson(jsonString: string): string {
    try {
      const parsedJson = JSON.parse(jsonString);
      return JSON.stringify(parsedJson, null, 2);
    } catch (e) {
      // If parsing fails, return the original string; it might not be JSON or already formatted
      return jsonString;
    }
  }
}
