import { Routes } from '@angular/router';
import { GroupTypesComponent } from './components/group-types/group-types.component';
import { GroupsComponent } from './components/groups/groups.component';
import { GroupComponent } from './components/group/group.component';
import { ResourcesComponent } from './components/resources/resources.component';
import { ResourceComponent } from './components/resource/resource.component';
import { VersionDetailComponent } from './components/version-detail/version-detail.component';
import { ConfigComponent } from './components/config/config.component';
import { BootstrapComponent } from './components/bootstrap/bootstrap.component';

export const routes: Routes = [
  { path: '', component: GroupTypesComponent },
  { path: 'bootstrap', component: BootstrapComponent },
  { path: 'config', component: ConfigComponent },
  { path: ':groupType', component: GroupsComponent },
  { path: ':groupType/:groupId', component: GroupComponent },
  { path: ':groupType/:groupId/:resourceType', component: ResourcesComponent },
  // Resource detail page that handles both single and multi-version cases
  { path: ':groupType/:groupId/:resourceType/:resourceId', component: ResourceComponent },
  // Direct path to a specific version
  { path: ':groupType/:groupId/:resourceType/:resourceId/versions/:versionId', component: VersionDetailComponent },
  { path: '**', redirectTo: '' }
];
