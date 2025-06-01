import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { GroupTypesComponent } from './group-types.component';
import { ModelService } from '../../services/model.service';
import { ConfigService } from '../../services/config.service';
import { PLATFORM_ID } from '@angular/core';

describe('GroupTypesComponent', () => {
  let component: GroupTypesComponent;
  let fixture: ComponentFixture<GroupTypesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GroupTypesComponent,
        HttpClientTestingModule
      ],
      providers: [
        ModelService,
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupTypesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
