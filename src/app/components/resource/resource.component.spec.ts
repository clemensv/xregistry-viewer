import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ResourceComponent } from './resource.component';
import { RegistryService } from '../../services/registry.service';
import { ConfigService } from '../../services/config.service';
import { ModelService } from '../../services/model.service';
import { PLATFORM_ID } from '@angular/core';

describe('ResourceComponent', () => {
  let component: ResourceComponent;
  let fixture: ComponentFixture<ResourceComponent>;
  beforeEach(async () => {
    const activatedRouteMock = {
      params: of({
        groupType: 'endpoints',
        groupId: 'test-group',
        resourceId: 'test-resource'
      }),
      paramMap: of({
        get: jest.fn((key: string) => {
          const params: { [key: string]: string } = {
            groupType: 'endpoints',
            groupId: 'test-group',
            resourceId: 'test-resource'
          };
          return params[key] || '';
        })
      }),
      queryParams: of({}),
      snapshot: {
        params: {
          groupType: 'endpoints',
          groupId: 'test-group',
          resourceId: 'test-resource'
        },
        queryParams: {}
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        ResourceComponent,
        HttpClientTestingModule
      ],
      providers: [
        RegistryService,
        ConfigService,
        ModelService,
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
