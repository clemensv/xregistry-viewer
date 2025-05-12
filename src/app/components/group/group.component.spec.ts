import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { GroupComponent } from './group.component';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';

describe('GroupComponent', () => {
  let component: GroupComponent;
  let fixture: ComponentFixture<GroupComponent>;
  let mockActivatedRoute: any;
  let mockRegistryService: any;
  let mockModelService: any;

  beforeEach(async () => {
    mockActivatedRoute = {
      paramMap: of({
        get: (param: string) => {
          if (param === 'groupType') return 'testGroupType';
          if (param === 'groupId') return 'testGroupId';
          return null;
        }
      })
    };

    mockRegistryService = jasmine.createSpyObj('RegistryService', ['getGroup']);
    mockRegistryService.getGroup.and.returnValue(of({
      id: 'testGroupId',
      name: 'Test Group',
      description: 'This is a test group',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    }));

    mockModelService = jasmine.createSpyObj('ModelService', ['getRegistryModel']);
    mockModelService.getRegistryModel.and.returnValue(of({
      groups: {
        testGroupType: {
          attributes: {
            description: { type: 'string' },
            name: { type: 'string' }
          },
          resources: {
            testResource1: {},
            testResource2: {}
          }
        }
      }
    }));

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, GroupComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: RegistryService, useValue: mockRegistryService },
        { provide: ModelService, useValue: mockModelService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load group details', () => {
    expect(mockRegistryService.getGroup).toHaveBeenCalledWith('testGroupType', 'testGroupId');
  });

  it('should load resource types', () => {
    component.resourceTypes$.subscribe((resourceTypes) => {
      const names = (resourceTypes as any[]).map(rt => (rt as any).name ?? (rt as any).type ?? rt);
      expect(names).toEqual(['testResource1', 'testResource2']);
    });
  });
});
