import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DebugService } from '../services/debug.service';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  constructor(private debug: DebugService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const startTime = Date.now();
    this.debug.log(`HTTP ${req.method} Request to ${req.urlWithParams} started`);

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            const duration = Date.now() - startTime;
            this.debug.log(`HTTP ${req.method} Response from ${req.urlWithParams} in ${duration}ms:`,
              event.status, event.statusText);

            // Log the body for debugging
            if (event.body) {
              this.debug.log('Response body type:', typeof event.body);
              try {
                if (typeof event.body === 'string' && event.body.length < 500) {
                  this.debug.log('Response body (string):', event.body);
                } else if (typeof event.body === 'object') {
                  this.debug.log('Response body keys:', Object.keys(event.body));
                }
              } catch (e) {
                this.debug.log('Error parsing response body:', e);
              }
            }
          }
        },
        error: (error: HttpErrorResponse) => {
          const duration = Date.now() - startTime;
          this.debug.error(`HTTP Error Response from ${req.urlWithParams} in ${duration}ms:`,
            error.status, error.statusText, error.message);
        }
      })
    );
  }
}
