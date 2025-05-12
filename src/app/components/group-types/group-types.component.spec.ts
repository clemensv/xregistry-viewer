import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupTypesComponent } from './group-types.component';

describe('GroupTypesComponent', () => {
  let component: GroupTypesComponent;
  let fixture: ComponentFixture<GroupTypesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupTypesComponent]
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
