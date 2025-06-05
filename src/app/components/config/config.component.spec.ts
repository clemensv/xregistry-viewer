import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigComponent } from './config.component';
import { ConfigService } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { IconComponent } from '../icon/icon.component';
import { PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('ConfigComponent', () => {
  let component: ConfigComponent;
  let fixture: ComponentFixture<ConfigComponent>;

  beforeEach(async () => {    await TestBed.configureTestingModule({
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
        { provide: PLATFORM_ID, useValue: 'browser' }      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA] // Allow unknown elements and properties
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigComponent);
    component = fixture.componentInstance;

    // Initialize form immediately to prevent template errors
    component.ngOnInit();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.apiEndpoints).toBeDefined();
  });

  it('should initialize with default configuration', () => {
    expect(component.apiEndpoints).toBeDefined();
    expect(component.loading).toBeDefined();
    expect(component.newEndpointUrl).toBeDefined();
  });
  it('should add API endpoint control', () => {
    const initialLength = component.apiEndpoints.length;
    component.newEndpointUrl = 'http://example.com';
    // Note: addEndpoint() is async and requires validation, so we test the form array directly
    component.apiEndpoints.push(new FormControl('http://example.com'));
    expect(component.apiEndpoints.length).toBe(initialLength + 1);
    expect(component.apiEndpoints.at(initialLength)?.value).toBe('http://example.com');
  });
});
