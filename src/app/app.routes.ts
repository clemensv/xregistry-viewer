import { Routes } from '@angular/router';
import { GroupTypesComponent } from './components/group-types/group-types.component';
import { GroupsComponent } from './components/groups/groups.component';
import { ResourcesComponent } from './components/resources/resources.component';
import { ResourceComponent } from './components/resource/resource.component';
import { VersionDetailComponent } from './components/version-detail/version-detail.component';
import { ConfigComponent } from './components/config/config.component';
import { BootstrapComponent } from './components/bootstrap/bootstrap.component';
import { ModelComponent } from './components/model/model.component';
import { DebugModelComponent } from './components/debug-model/debug-model.component';
import { ApiTesterComponent } from './components/api-tester/api-tester.component';
import { GroupValidatorComponent } from './components/group-validator/group-validator.component';
import { UrlDebugComponent } from './components/url-debug/url-debug.component';
export const routes: Routes = [
  { path: '', component: GroupTypesComponent },
  { path: 'debug-model', component: DebugModelComponent },
  { path: 'api-test', component: ApiTesterComponent },
  { path: 'group-validator', component: GroupValidatorComponent },
  { path: 'url-debug', component: UrlDebugComponent },
  { path: 'bootstrap', component: BootstrapComponent },
  { path: 'config', component: ConfigComponent },
  { path: 'model', component: ModelComponent },
  { path: 'model/:groupType', component: ModelComponent },
  { path: ':groupType', component: GroupsComponent },
  { path: ':groupType/:groupId/:resourceType', component: ResourcesComponent },
  // Resource detail page that handles both single and multi-version cases
  { path: ':groupType/:groupId/:resourceType/:resourceId', component: ResourceComponent },
  // Direct path to a specific version
  { path: ':groupType/:groupId/:resourceType/:resourceId/versions/:versionId', component: VersionDetailComponent },
  // Redirect group detail route to grid view with highlight param - moved to end to avoid conflicts
  { path: ':groupType/:groupId', redirectTo: ':groupType?highlight=:groupId', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
