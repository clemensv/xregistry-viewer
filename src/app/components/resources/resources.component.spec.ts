import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ResourcesComponent } from './resources.component';
import { RegistryService } from '../../services/registry.service';
import { ConfigService } from '../../services/config.service';
import { ModelService } from '../../services/model.service';
import { IconComponent } from '../icon/icon.component';
import { PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('ResourcesComponent', () => {
  let component: ResourcesComponent;
  let fixture: ComponentFixture<ResourcesComponent>;
  beforeEach(async () => {
    const activatedRouteMock = {
      params: of({ groupType: 'endpoints', groupId: 'test-group' }),
      queryParams: of({}),
      snapshot: {
        params: { groupType: 'endpoints', groupId: 'test-group' },
        queryParams: {},
        paramMap: {
          get: jest.fn((key: string) => {
            const params: { [key: string]: string } = { groupType: 'endpoints', groupId: 'test-group' };
            return params[key] || '';
          })
        },
        queryParamMap: {
          get: jest.fn(() => '')
        }
      }
    };    await TestBed.configureTestingModule({
      imports: [
        ResourcesComponent,
        HttpClientTestingModule
      ],providers: [
        RegistryService,
        ConfigService,
        ModelService,
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResourcesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
