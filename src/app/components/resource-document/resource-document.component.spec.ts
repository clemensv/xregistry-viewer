import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResourceDocumentComponent } from './resource-document.component';

describe('ResourceDocumentComponent', () => {
  let component: ResourceDocumentComponent;
  let fixture: ComponentFixture<ResourceDocumentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceDocumentComponent]
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
