import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { HighlightService } from '../../services/highlight.service';

@Component({
  selector: 'app-code-highlight',
  standalone: true, // Make it a standalone component
  imports: [CommonModule], // Import CommonModule for [innerHTML]
  templateUrl: './code-highlight.component.html',
  styleUrls: ['./code-highlight.component.scss']
})
export class CodeHighlightComponent implements OnChanges, AfterViewInit {
  @Input() code: string = '';
  @Input() language?: string;
  highlightedCode: string = '';

  // Use ViewChild to get the code element for manual highlighting if needed
  // @ViewChild('codeElement') codeElement?: ElementRef<HTMLElement>; // Not strictly needed with [innerHTML]

  constructor(private highlightService: HighlightService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['code'] || changes['language']) {
      this.highlight();
    }
  }

  ngAfterViewInit(): void {
    // Initial highlight after view is ready, if code is already present
    if (this.code && !this.highlightedCode) { // Highlight only if not already done by ngOnChanges
        this.highlight();
    }
  }

  private highlight(): void {
    if (this.code) {
      let finalCode = this.code;
      let langToUse = this.language;

      // Attempt to detect and format if it's JSON and no language is specified or if language is 'json'
      if ((!langToUse || langToUse === 'json') && this.highlightService.isJson(this.code)) {
        finalCode = this.highlightService.formatJson(this.code);
        langToUse = 'json'; // Ensure we use json highlighter
      }
      this.highlightedCode = this.highlightService.highlightCode(finalCode, langToUse);

    } else {
      this.highlightedCode = '';
    }
  }
}
