import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ResourceDocumentComponent } from './resource-document.component';
import { RegistryService } from '../../services/registry.service';
import { ConfigService } from '../../services/config.service';
import { ModelService } from '../../services/model.service';
import { PLATFORM_ID } from '@angular/core';

describe('ResourceDocumentComponent', () => {
  let component: ResourceDocumentComponent;
  let fixture: ComponentFixture<ResourceDocumentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ResourceDocumentComponent,
        HttpClientTestingModule
      ],
      providers: [
        RegistryService,
        ConfigService,
        ModelService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResourceDocumentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
