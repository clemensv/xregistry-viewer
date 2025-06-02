import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigComponent } from './config.component';
import { ConfigService } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { PLATFORM_ID } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ConfigComponent', () => {
  let component: ConfigComponent;
  let fixture: ComponentFixture<ConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ConfigComponent,
        ReactiveFormsModule,
        HttpClientTestingModule
      ],
      providers: [
        ConfigService,
        BaseUrlService,
        { provide: Location, useValue: { back: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [NO_ERRORS_SCHEMA] // Allow unknown elements and properties
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigComponent);
    component = fixture.componentInstance;

    // Initialize form immediately to prevent template errors
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.configForm).toBeDefined();
  });

  it('should initialize with default configuration', () => {
    expect(component.configForm).toBeDefined();
    expect(component.apiEndpointControls).toBeDefined();
    expect(component.configForm.get('baseUrl')).toBeTruthy();
  });

  it('should add API endpoint control', () => {
    const initialLength = component.apiEndpointControls.length;
    component.addApiEndpoint();
    expect(component.apiEndpointControls.length).toBe(initialLength + 1);
    expect(component.apiEndpointControls[initialLength].value).toBe('');
  });
});
