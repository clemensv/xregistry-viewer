import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { GroupsComponent } from './groups.component';
import { RegistryService } from '../../services/registry.service';
import { ConfigService } from '../../services/config.service';
import { ModelService } from '../../services/model.service';
import { PLATFORM_ID } from '@angular/core';

describe('GroupsComponent', () => {
  let component: GroupsComponent;
  let fixture: ComponentFixture<GroupsComponent>;  beforeEach(async () => {
    const activatedRouteMock = {
      params: of({}),
      queryParams: of({}),
      queryParamMap: of({
        get: jest.fn(() => '')
      }),
      snapshot: { 
        params: {}, 
        queryParams: {},
        paramMap: {
          get: jest.fn((key: string) => {
            const params: { [key: string]: string } = {};
            return params[key] || '';
          })
        },
        queryParamMap: {
          get: jest.fn(() => '')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        GroupsComponent,
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

    fixture = TestBed.createComponent(GroupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
