import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { VersionDetailComponent } from './version-detail.component';
import { RegistryService } from '../../services/registry.service';
import { ConfigService } from '../../services/config.service';
import { ModelService } from '../../services/model.service';
import { PLATFORM_ID } from '@angular/core';

describe('VersionDetailComponent', () => {
  let component: VersionDetailComponent;
  let fixture: ComponentFixture<VersionDetailComponent>;
  beforeEach(async () => {
    const activatedRouteMock = {
      params: of({
        groupType: 'endpoints',
        groupId: 'test-group',
        resourceId: 'test-resource',
        versionId: 'v1'
      }),
      paramMap: of({
        get: jest.fn((key: string) => {
          const params: { [key: string]: string } = {
            groupType: 'endpoints',
            groupId: 'test-group',
            resourceId: 'test-resource',
            versionId: 'v1'
          };
          return params[key] || '';
        })
      }),
      queryParams: of({}),
      snapshot: {
        params: {
          groupType: 'endpoints',
          groupId: 'test-group',
          resourceId: 'test-resource',
          versionId: 'v1'
        },
        queryParams: {}
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        VersionDetailComponent,
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

    fixture = TestBed.createComponent(VersionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
