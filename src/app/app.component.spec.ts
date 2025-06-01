import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div>
      <h1>{{ title }}</h1>
      <div>Welcome to {{ title }}!</div>
    </div>
  `,
})
export class AppComponent {
  title = 'xregistry-viewer';
}

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have title "xregistry-viewer"', () => {
    expect(component.title).toEqual('xregistry-viewer');
  });

  it('should render title', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('xregistry-viewer');
  });

  it('should render welcome message', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Welcome to xregistry-viewer!');
  });
});
